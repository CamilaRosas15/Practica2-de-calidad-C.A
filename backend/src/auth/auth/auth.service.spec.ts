import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { SupabaseService } from 'src/supabase/supabase/supabase.service';
import { ConflictException, InternalServerErrorException, UnauthorizedException, Logger } from '@nestjs/common';

const supabaseClientMock = () => ({
  auth: {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
  },
});

const supabaseServiceMock = () => ({
  getClient: jest.fn(),
});

const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const originalSetTimeout = setTimeout;
beforeAll(() => {
  (global.setTimeout as any) = (fn: (...args: any[]) => void, ms?: number, ...args: any[]): NodeJS.Timeout => {
    fn(...args); 
    return originalSetTimeout(() => {}, 0) as any; 
  };
});

afterAll(() => {
  global.setTimeout = originalSetTimeout; 
});


describe('AuthService', () => {
  let service: AuthService;
  let client: ReturnType<typeof supabaseClientMock>;
  let supabaseSvc: ReturnType<typeof supabaseServiceMock>;

  describe('AuthService.register (branch coverage)', () => {
    beforeEach(async () => {
      client = supabaseClientMock(); 
      supabaseSvc = supabaseServiceMock();
      supabaseSvc.getClient.mockReturnValue(client);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: SupabaseService, useValue: supabaseSvc },
          // { provide: Logger, useValue: mockLogger },
        ],
      }).compile();

      service = module.get(AuthService);
      jest.clearAllMocks(); 
    });

    it('1) Camino feliz: signUp OK con user y session → retorna {data, null}', async () => {
      client.auth.signUp.mockResolvedValue({
        data: { user: { id: 'u1' }, session: { access_token: 'Tdsggdf' } },
        error: null,
      });

      const res = await service.register({ email: 'esta.es.una.prueba@gmail.com', password: '123456' });

      expect(client.auth.signUp).toHaveBeenCalledWith({
        email: 'esta.es.una.prueba@gmail.com',
        password: '123456',
        options: expect.any(Object),
      });
      expect(res.error).toBeNull();
      expect(res.data?.user?.id).toBe('u1');
      expect(res.data?.session?.access_token).toBe('Tdsggdf');
    });

    it('2) User sin session: llama forceLoginAfterRegistration y retorna su resultado', async () => {
      client.auth.signUp.mockResolvedValue({
        data: { user: { id: 'u1' }, session: null },
        error: null,
      });

      const forced = {
        data: { user: { id: 'u1' }, session: { access_token: 'FORCED' } },
        error: null,
      };

      const spyForce = jest
        .spyOn<any, any>(service as any, 'forceLoginAfterRegistration')
        .mockResolvedValue(forced);

      const res = await service.register({ email: 'ops.rate.limit@gmail.com', password: '12345678' });

      expect(spyForce).toHaveBeenCalledWith('ops.rate.limit@gmail.com', '12345678');
      expect(res.data?.session?.access_token).toBe('FORCED');
    });

    it('3) Error conocido: "User already registered" → ConflictException', async () => {
      client.auth.signUp.mockResolvedValue({
        data: null,
        error: { message: 'User already registered' } as any,
      });

      await expect(
        service.register({ email: 'ya.registrada@gmail.com,', password: '12345678' }),
      ).rejects.toThrow(ConflictException);
    });

    it('4) Error distinto → InternalServerErrorException con mensaje', async () => {
      client.auth.signUp.mockResolvedValue({
        data: null,
        error: { message: 'DB down' } as any,
      });

      await expect(
        service.register({ email: 'pruebas.reg2@gmail.com', password: '12345678' }),
      ).rejects.toThrow(InternalServerErrorException);

      await expect(
        service.register({ email: 'pruebas.reg2@gmail.com', password: '12345678' }),
      ).rejects.toThrow('Registration failed: DB down');
    });
  });

  describe('AuthService.forceLoginAfterRegistration (Path Coverage - Complejidad Ciclomática 4)', () => {
    beforeEach(async () => {
      client = supabaseClientMock(); 
      supabaseSvc = supabaseServiceMock();
      supabaseSvc.getClient.mockReturnValue(client);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: SupabaseService, useValue: supabaseSvc },
          { provide: Logger, useValue: mockLogger }, 
        ],
      }).compile();

      service = module.get(AuthService);
      (service as any).logger = mockLogger;

      jest.clearAllMocks();
    });

    const callForceLogin = (email: string, password: string) => {
      return (service as any).forceLoginAfterRegistration(email, password);
    };

    it('1) Camino: Login exitoso en el primer intento (happy path).', async () => {
      client.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: { id: 'u1' }, session: { access_token: 'FIRST_ATTEMPT_TOKEN' } },
        error: null,
      });

      const email = 'path1@example.com';
      const password = 'password1';
      const result = await callForceLogin(email, password);

      expect(client.auth.signInWithPassword).toHaveBeenCalledTimes(1);
      expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email, password });
      expect(result.data?.session?.access_token).toBe('FIRST_ATTEMPT_TOKEN');
      expect(result.error).toBeNull();
      expect(mockLogger.log).toHaveBeenCalledWith(`Forced login successful on attempt 1`);
    });

    it('2) Camino: Email no confirmado en intentos iniciales, luego login exitoso.', async () => {
      client.auth.signInWithPassword
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Email not confirmed' } as any,
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Email not confirmed' } as any,
        })
        .mockResolvedValueOnce({
          data: { user: { id: 'u2' }, session: { access_token: 'SUCCESS_AFTER_CONFIRM' } },
          error: null,
        });

      const email = 'path2@example.com';
      const password = 'password2';
      const result = await callForceLogin(email, password);

      expect(client.auth.signInWithPassword).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledWith(`Attempt 1 failed - email not confirmed, waiting 2 seconds`);
      expect(mockLogger.warn).toHaveBeenCalledWith(`Attempt 2 failed - email not confirmed, waiting 2 seconds`);
      expect(mockLogger.log).toHaveBeenCalledWith(`Forced login successful on attempt 3`);
      expect(result.data?.session?.access_token).toBe('SUCCESS_AFTER_CONFIRM');
      expect(result.error).toBeNull();
    });
  });
    describe('login()', () => {
    it('1) camino feliz → retorna data/session', async () => {
      client.auth.signInWithPassword.mockResolvedValue({
        data: { user: { id: 'u3' }, session: { access_token: 'djdskfhaskdjhfjk' } },
        error: null,
      });

      const res = await service.login({ email: 'camilaprueba@a.com', password: 'prueba123' });

      expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'camilaprueba@a.com',
        password: 'prueba123',
      });
      expect(res.error).toBeNull();
      expect(res.data?.user?.id).toBe('u3');
      expect(res.data?.session?.access_token).toBe('djdskfhaskdjhfjk');
    });

    it('2) email no confirmado → definitiveEmailConfirmationSolution y retorna', async () => {
      client.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Email not confirmed' },
      });

      const spyDef = jest
        .spyOn<any, any>(service as any, 'definitiveEmailConfirmationSolution')
        .mockResolvedValue({
          data: { user: { id: 'u2' }, session: { access_token: 'CONF' } },
          error: null,
        });

      const res = await service.login({ email: 'pending@x.com', password: '123456' });

      expect(spyDef).toHaveBeenCalledWith('pending@x.com', '123456');
      expect(res.error).toBeNull();
      expect(res.data?.session?.access_token).toBe('CONF');
    });

    it('3) credenciales invalidas → Unauthorized con mensaje', async () => {
      client.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid login credentials' },
      });

      await expect(
        service.login({ email: 'badprueba@x.com', password: 'wrong' })
      ).rejects.toThrow('Invalid email or password.');
    });

    it('4) error genErico → Unauthorized con detalle del proveedor', async () => {
      client.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'rate limit exceeded' },
      });

      await expect(
        service.login({ email: 'rate@x.com', password: '123456' })
      ).rejects.toThrow('Login failed: rate limit exceeded');
    });
  });
  describe('AuthService.saveUserProfile (statement coverage)', () => {
  let fromMock: jest.Mock;
  let upsertMock: jest.Mock;
  let selectMock: jest.Mock;
  let singleMock: jest.Mock;

  beforeEach(async () => {
    client = supabaseClientMock();

    singleMock = jest.fn();
    selectMock = jest.fn().mockReturnValue({ single: singleMock });
    upsertMock = jest.fn().mockReturnValue({ select: selectMock });
    fromMock   = jest.fn().mockReturnValue({ upsert: upsertMock, select: selectMock, single: singleMock });

    const clientWithFrom: any = { ...client, from: fromMock };

    supabaseSvc = supabaseServiceMock();
    supabaseSvc.getClient.mockReturnValue(clientWithFrom);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: SupabaseService, useValue: supabaseSvc },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
  });

  it('1) guarda OK con normalizaciones (sexo inválido, arrays a CSV, usa calorías objetivo como fallback)', async () => {
    const userId = 'u123';
    const profileDto: any = {
      nombre_completo: 'Cami Dev',
      edad: 22,
      peso: 60,
      altura: 1.65,
      sexo: 'NoValido',               
      gustos: ['pizza', 'pasta'],      
      alergias: [],                    
      no_me_gusta: ['cebolla'],        
      objetivo_calorico: undefined,    
      calorias_diarias_objetivo: 1800,
      objetivo_salud: 'fit',
    };

    singleMock.mockResolvedValue({ data: { id: userId, nombre: 'Cami Dev', sexo: 'Otro' }, error: null });

    const res = await service.saveUserProfile(userId, profileDto);

    expect(fromMock).toHaveBeenCalledWith('usuario_detalles');
    expect(upsertMock).toHaveBeenCalledTimes(1);

    const payload = upsertMock.mock.calls[0][0];
    const options = upsertMock.mock.calls[0][1];

    expect(options).toEqual({ onConflict: 'id' });
    expect(payload).toEqual(
      expect.objectContaining({
        id: userId,
        nombre: 'Cami Dev',
        edad: 22,
        altura: 1.65,
        peso: 60,
        sexo: 'Otro',
        objetivo_calorico: 1800,     
        gustos: 'pizza, pasta',
        alergias: '',                
        no_me_gusta: 'cebolla',
      })
    );

    expect(res).toEqual({ id: userId, nombre: 'Cami Dev', sexo: 'Otro' });
  });

  it('2) guarda OK con sexo válido y strings; usa objetivo_calorico (sin fallback)', async () => {
    const userId = 'u200';
    const profileDto: any = {
      nombre_completo: 'Alex',
      edad: 30,
      peso: 80,
      altura: 1.8,
      sexo: 'Femenino',          
      gustos: 'helado',            
      alergias: 'mani',            
      no_me_gusta: '',             
      objetivo_calorico: 2000,     
      calorias_diarias_objetivo: 1500, 
      objetivo_salud: 'salud',
    };

    singleMock.mockResolvedValue({ data: { id: userId, nombre: 'Alex', sexo: 'Femenino' }, error: null });

    const res = await service.saveUserProfile(userId, profileDto);

    const payload = upsertMock.mock.calls[0][0];
    expect(payload).toEqual(
      expect.objectContaining({
        id: userId,
        nombre: 'Alex',
        edad: 30,
        altura: 1.8,
        peso: 80,
        sexo: 'Femenino',
        objetivo_calorico: 2000,  
        gustos: 'helado',
        alergias: 'mani',
        no_me_gusta: '',
      })
    );

    expect(res).toEqual({ id: userId, nombre: 'Alex', sexo: 'Femenino' });
  });

  it('3) nombre_completo requerido + retorna InternalServerError y NO llama a DB', async () => {
    const userId = 'u999';
    const profileDto: any = { nombre_completo: '   ' };

    await expect(service.saveUserProfile(userId, profileDto))
      .rejects.toThrow(new InternalServerErrorException('Failed to save user profile.'));

    expect(fromMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('4) error del DB al guardar + retorna InternalServerError("Failed to save user profile.")', async () => {
    const userId = 'u777';
    const profileDto: any = {
      nombre_completo: 'Dana',
      edad: 25,
      peso: 55,
      sexo: 'Masculino',
      gustos: 'asado',
      alergias: '',
      no_me_gusta: '',
    };

    singleMock.mockResolvedValue({ data: null, error: { message: 'duplicate key' } });

    await expect(service.saveUserProfile(userId, profileDto))
      .rejects.toThrow(new InternalServerErrorException('Failed to save user profile.'));

    expect(fromMock).toHaveBeenCalledWith('usuario_detalles');
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it('5) excepción inesperada (SDK/Network) → lanza InternalServerError("Failed to save user profile.")', async () => {
    const userId = 'u0989';
    const profileDto: any = { nombre_completo: 'Pat', edad: 28, peso: 70 };

    singleMock.mockRejectedValue(new Error('Network down'));

    await expect(service.saveUserProfile(userId, profileDto))
      .rejects.toThrow(new InternalServerErrorException('Failed to save user profile.'));

    expect(fromMock).toHaveBeenCalledWith('usuario_detalles');
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });
});
describe('AuthService.getUserProfile statement + branck coverage )', () => {
  let fromMock: jest.Mock;
  let selectMock: jest.Mock;
  let eqMock: jest.Mock;
  let singleMock: jest.Mock;

  beforeEach(async () => {
    client = supabaseClientMock();

    singleMock = jest.fn();
    eqMock     = jest.fn().mockReturnValue({ single: singleMock });
    selectMock = jest.fn().mockReturnValue({ eq: eqMock });
    fromMock   = jest.fn().mockReturnValue({ select: selectMock, eq: eqMock, single: singleMock });

    const clientWithFrom: any = { ...client, from: fromMock };

    supabaseSvc = supabaseServiceMock();
    supabaseSvc.getClient.mockReturnValue(clientWithFrom);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: SupabaseService, useValue: supabaseSvc },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
  });

  it('1) retorna el perfil cuando existe (happy path)', async () => {
    const userId = 'u123';
    const dbRow = { id: userId, nombre: 'Cami Dev', sexo: 'Femenino' };

    singleMock.mockResolvedValue({ data: dbRow, error: null });

    const res = await service.getUserProfile(userId);

    expect(fromMock).toHaveBeenCalledWith('usuario_detalles');
    expect(selectMock).toHaveBeenCalledWith('*');
    expect(eqMock).toHaveBeenCalledWith('id', userId);
    expect(res).toEqual(dbRow);
  });

  it('2) no hay perfil (PGRST116) → retorna null', async () => {
    const userId = 'u404';
    singleMock.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'No rows' } });

    const res = await service.getUserProfile(userId);

    expect(fromMock).toHaveBeenCalledWith('usuario_detalles');
    expect(selectMock).toHaveBeenCalledWith('*');
    expect(eqMock).toHaveBeenCalledWith('id', userId);
    expect(res).toBeNull();
  });

  it('3) error de BD distinto a PGRST116 → lanza InternalServerError("Failed to fetch user profile.")', async () => {
    const userId = 'u500';
    singleMock.mockResolvedValue({ data: null, error: { code: 'LSKJF001', message: 'db exploded' } });

    await expect(service.getUserProfile(userId))
      .rejects.toThrow(new InternalServerErrorException('Failed to fetch user profile.'));
  });

  it('4) excepción inesperada (SDK/Network) → lanza InternalServerError("Failed to fetch user profile.")', async () => {
    const userId = 'uX';
    singleMock.mockRejectedValue(new Error('Network down'));

    await expect(service.getUserProfile(userId))
      .rejects.toThrow(new InternalServerErrorException('Failed to fetch user profile.'));
  });
});
describe('AuthService.logout statement + branck coverage', () => {
  let signOutMock: jest.Mock;

  beforeEach(async () => {
    client = supabaseClientMock();

    signOutMock = jest.fn();
    const clientWithSignOut: any = {
      ...client,
      auth: {
        ...client.auth,
        signOut: signOutMock,
      },
    };

    supabaseSvc = supabaseServiceMock();
    supabaseSvc.getClient.mockReturnValue(clientWithSignOut);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: SupabaseService, useValue: supabaseSvc },
        { provide: Logger, useValue: mockLogger }, 
      ],
    }).compile();

    service = module.get(AuthService);
    (service as any).logger = mockLogger;
    jest.clearAllMocks();
  });

  it('1) signOut sin error → registra éxito', async () => {
    signOutMock.mockResolvedValue({ error: null });

    await service.logout();

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Logout error:')
    );
    expect(mockLogger.log).toHaveBeenCalledWith('User logged out successfully');
  });

  it('2) signOut con {error} → loguea error y luego Exito', async () => {
    signOutMock.mockResolvedValue({ error: { message: 'rate limit' } });

    await service.logout();

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith('Logout error: rate limit');
    expect(mockLogger.log).toHaveBeenCalledWith('User logged out successfully');
  });

  it('3) signOut lanza (SDK/Network) → loguea unexpected error', async () => {
    signOutMock.mockRejectedValue(new Error('Network down'));

    await service.logout();

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Unexpected logout error: Network down'
    );
    expect(mockLogger.log).not.toHaveBeenCalledWith('User logged out successfully');
  });
});
describe('AuthService.definitiveEmailConfirmationSolution', () => {
  beforeEach(async () => {
    client = supabaseClientMock();
    supabaseSvc = supabaseServiceMock();
    supabaseSvc.getClient.mockReturnValue(client);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: SupabaseService, useValue: supabaseSvc },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get(AuthService);
    (service as any).logger = mockLogger;

    jest.clearAllMocks();
  });

  const callDef = (email: string, password: string) =>
    (service as any).definitiveEmailConfirmationSolution(email, password);

  it('1) exito en el primer intento y loguea error de signup (mensaje distinto a "already registered")', async () => {
    client.auth.signUp.mockResolvedValue({
      data: {},
      error: { message: 'quota exceeded' },
    });

    client.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'u1' }, session: { access_token: 'T1' } },
      error: null,
    });

    const res = await callDef('prueba1@gmail.com', 'pass1');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Signup attempt failed: quota exceeded',
    );
    expect(client.auth.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(res.data?.session?.access_token).toBe('T1');
  });

  it('2) 2 fallos y luego exito; signup "already registered" NO loguea error', async () => {
    client.auth.signUp.mockResolvedValue({
      data: {},
      error: { message: 'already registered' },
    });

    client.auth.signInWithPassword
      .mockResolvedValueOnce({ data: null, error: { message: 'rate limit' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'temporarily unavailable' } })
      .mockResolvedValueOnce({
        data: { user: { id: 'u3' }, session: { access_token: 'T3' } },
        error: null,
      });

    const res = await callDef('prueba2@gmail.com', 'pass2');

    expect(mockLogger.error).not.toHaveBeenCalledWith(
      expect.stringContaining('Signup attempt failed:'),
    );

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Attempt 1 failed - waiting 1000ms',
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Attempt 2 failed - waiting 2000ms',
    );
    expect(mockLogger.log).toHaveBeenCalledWith(
      'Definitive solution successful on attempt 3',
    );
    expect(res.data?.session?.access_token).toBe('T3');
  });

  it('3) 8 intentos fallidos → catch → Unauthorized("Please try…")', async () => {
    client.auth.signUp.mockResolvedValue({ data: {}, error: null });

    for (let i = 0; i < 8; i++) {
      client.auth.signInWithPassword.mockResolvedValueOnce({
        data: null,
        error: { message: 'Email not confirmed' },
      });
    }

    await expect(callDef('prueba3@gmail.com', 'pass3')).rejects.toThrow(
      new UnauthorizedException('Please try registering again or use a different email.'),
    );

    expect(client.auth.signInWithPassword).toHaveBeenCalledTimes(8);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Attempt 8 failed - waiting 8000ms',
    );
  });

  it('4) signup lanza → catch → Unauthorized("Please try…")', async () => {
    client.auth.signUp.mockRejectedValue(new Error('network down'));

    await expect(callDef('prueba4@gmail.com', 'pass4')).rejects.toThrow(
      new UnauthorizedException('Please try registering again or use a different email.'),
    );

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Definitive solution failed: network down',
    );
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

});
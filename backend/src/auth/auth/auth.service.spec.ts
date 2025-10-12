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
    const userId = 'uX';
    const profileDto: any = { nombre_completo: 'Pat', edad: 28, peso: 70 };

    singleMock.mockRejectedValue(new Error('Network down'));

    await expect(service.saveUserProfile(userId, profileDto))
      .rejects.toThrow(new InternalServerErrorException('Failed to save user profile.'));

    expect(fromMock).toHaveBeenCalledWith('usuario_detalles');
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });
});

});
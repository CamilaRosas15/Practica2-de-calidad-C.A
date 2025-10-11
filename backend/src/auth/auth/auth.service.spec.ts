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
});
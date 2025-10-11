import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { SupabaseService } from 'src/supabase/supabase/supabase.service';
import { ConflictException, InternalServerErrorException } from '@nestjs/common';

describe('AuthService.register (branch coverage)', () => {
  let service: AuthService;

  // Mock mínimo del cliente de Supabase que necesitamos
  const supabaseClientMock = () => ({
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
    },
  });

  const supabaseServiceMock = () => ({
    getClient: jest.fn(),
  });

  let client: ReturnType<typeof supabaseClientMock>;
  let supabaseSvc: ReturnType<typeof supabaseServiceMock>;

  beforeEach(async () => {
    client = supabaseClientMock();
    supabaseSvc = supabaseServiceMock();
    supabaseSvc.getClient.mockReturnValue(client);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: SupabaseService, useValue: supabaseSvc },
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

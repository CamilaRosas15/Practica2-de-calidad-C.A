import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth/auth.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;

  const authServiceMock = {
    login: jest.fn(),
    register: jest.fn(),
    saveUserProfile: jest.fn(),
    getUserProfile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('register devuelve message, userId y email', async () => {
    authServiceMock.register.mockResolvedValue({
      data: { user: { id: 'u1' } },
      error: null,
    });

    const dto = { email: 'camila@gmail.com', password: '123456' };
    const res = await controller.register(dto as any);

    expect(authServiceMock.register).toHaveBeenCalledWith(dto);
    expect(res).toEqual({
      message: 'User registered successfully. Please complete your profile.',
      userId: 'u1',
      email: 'camila@gmail.com',
    });
  });
  it('login devuelve message, accessToken y user', async () => {
    authServiceMock.login.mockResolvedValue({
      data: { user: { id: 'u2' }, session: { access_token: 'adafn87n3nkaifinq' } },
      error: null,
    });

    const dto = { email: 'camila.pruba@gmail.com', password: '123456' };
    const res = await controller.login(dto as any);

    expect(authServiceMock.login).toHaveBeenCalledWith(dto);
    expect(res).toEqual({
      message: 'Logged in successfully',
      accessToken: 'adafn87n3nkaifinq',
      user: { id: 'u2' },
    });
  });
});

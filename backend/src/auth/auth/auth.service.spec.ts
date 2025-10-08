import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { SupabaseService } from 'src/supabase/supabase/supabase.service';

describe('AuthService', () => {
  let service: AuthService;
  // Mock minimo del cliente de Supabase
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

  it('should be defined', () => {
     expect(service).toBeDefined();
  });

  
});

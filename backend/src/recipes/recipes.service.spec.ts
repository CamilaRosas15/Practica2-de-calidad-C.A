import { Test, TestingModule } from '@nestjs/testing';
import { RecipesService } from './recipes.service';
import { SupabaseService } from 'src/supabase/supabase/supabase.service';

describe('RecipesService', () => {
  let service: RecipesService;

  const supabaseMock = {
    getClient: jest.fn(() => ({
      auth: {
        signInWithPassword: jest.fn(),
        signUp: jest.fn(),
      },
    })),
    // agrega otros métodos si los usas dentro del service
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipesService,
        { provide: SupabaseService, useValue: supabaseMock }, // << mock
      ],
    }).compile();

    service = module.get<RecipesService>(RecipesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

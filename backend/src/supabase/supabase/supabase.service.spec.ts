import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from './supabase.service';
import { ConfigService } from '@nestjs/config';

describe('SupabaseService', () => {
  let service: SupabaseService;

  const configMock = {
    get: jest.fn((key: string) => {
      if (key === 'SUPABASE_URL') return 'https://example.supabase.co'; // URL válida
      if (key === 'SUPABASE_ANON_KEY') return 'ey_dummy_anon_key';      // cualquier string no vacío
      // si tu servicio usa otra clave, por ej. 'SUPABASE_SERVICE_KEY', añade otro if aquí
      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseService,
        { provide: ConfigService, useValue: configMock }, // << mock
      ],
    }).compile();

    service = module.get<SupabaseService>(SupabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

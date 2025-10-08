import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from './supabase.service';
import { ConfigService } from '@nestjs/config';

describe('SupabaseService', () => {
  let service: SupabaseService;

  const configMock = {
    get: jest.fn((key: string) => {
      if (key === 'SUPABASE_URL') return 'https://xwulpvlovglsfswmjwyt.supabase.co'; 
      if (key === 'SUPABASE_ANON_KEY') return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3dWxwdmxvdmdsc2Zzd21qd3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxMjE1ODEsImV4cCI6MjA3MzY5NzU4MX0.oqZk94gn8aXLt9SbmM98Yw0H1efcq4KuZAudCRNnnbE';
      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseService,
        { provide: ConfigService, useValue: configMock }, 
      ],
    }).compile();

    service = module.get<SupabaseService>(SupabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

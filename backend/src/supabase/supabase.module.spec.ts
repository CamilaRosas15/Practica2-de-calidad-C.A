import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseModule } from './supabase.module';
import { SupabaseService } from './supabase/supabase.service';
import { ConfigService } from '@nestjs/config';

describe('SupabaseModule', () => {
  // Mock del ConfigService para que el constructor del SupabaseService no falle.
  // Proporcionamos valores falsos para las variables de entorno.
  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'SUPABASE_URL') return 'https://fake-url.supabase.co';
      if (key === 'SUPABASE_ANON_KEY') return 'fake-key-for-testing';
      return null;
    }),
  };

  // Prueba 1: Verificar que el módulo se compila y el servicio es inyectable.
  it('should compile the module and provide the SupabaseService', async () => {
    // Creamos un módulo de prueba importando nuestro SupabaseModule real.
    const module: TestingModule = await Test.createTestingModule({
      imports: [SupabaseModule],
    })
    // Sobrescribimos el ConfigService real con nuestro mock para aislar la prueba.
    .overrideProvider(ConfigService)
    .useValue(mockConfigService)
    .compile();

    // Verificamos que el módulo se pudo crear.
    expect(module).toBeDefined();

    // Verificamos que podemos obtener una instancia del SupabaseService desde el módulo.
    // Esto prueba que el servicio está correctamente 'provided' y 'exported'.
    const service = module.get<SupabaseService>(SupabaseService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(SupabaseService);
  });
});
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NutrichefAiController } from './nutrichef-ai/nutrichef-ai.controller';
import { RecipesController } from './recipes/recipes.controller';
import { AuthController } from './auth/auth.controller';
import { ConfigService } from '@nestjs/config';

describe('AppModule', () => {
  let app: TestingModule;

  beforeAll(async () => {
    // Creamos un módulo de prueba importando nuestro AppModule real.
    app = await Test.createTestingModule({
      imports: [AppModule],
    })
    // Sobrescribimos el ConfigService. Esto es crucial porque el ConfigModule
    // real (importado por AppModule) intentaría leer un archivo .env.
    // Al sobreescribirlo aquí, afectamos a toda la aplicación de prueba.
    .overrideProvider(ConfigService)
    .useValue({
      get: jest.fn((key: string) => {
        // Devolvemos valores falsos pero válidos para las credenciales de Supabase
        if (key === 'SUPABASE_URL') return 'https://fake-url.com';
        if (key === 'SUPABASE_ANON_KEY') return 'fake-key';
        // Y para cualquier otra variable de entorno que puedan necesitar otros servicios
        if (key === 'GROQ_API_KEY') return 'fake-groq-key';
        return null;
      }),
    })
    .compile();
  });

  // Prueba 1: ¿Se pudo compilar el módulo principal?
  it('should compile the module successfully', () => {
    // Si el 'beforeAll' se completó sin errores, el módulo y todas
    // sus dependencias anidadas se pudieron resolver.
    expect(app).toBeDefined();
  });

  // Prueba 2: ¿Proporciona los controladores principales?
  it('should resolve the main controllers', () => {
    // Intentamos obtener una instancia de cada controlador principal.
    // Si esto funciona, significa que ellos y sus dependencias (servicios)
    // están correctamente inyectados en toda la aplicación.
    const appController = app.get<AppController>(AppController);
    const nutrichefAiController = app.get<NutrichefAiController>(NutrichefAiController);
    const recipesController = app.get<RecipesController>(RecipesController);
    const authController = app.get<AuthController>(AuthController); // Asumiendo que existe un AuthController en AuthModule

    expect(appController).toBeInstanceOf(AppController);
    expect(nutrichefAiController).toBeInstanceOf(NutrichefAiController);
    expect(recipesController).toBeInstanceOf(RecipesController);
    expect(authController).toBeInstanceOf(AuthController);
  });

  // Prueba 3 (Opcional pero recomendada): ¿Proporciona los servicios principales?
  it('should resolve the main services', () => {
    const appService = app.get<AppService>(AppService);
    // ... podrías añadir más servicios aquí si quisieras ser más exhaustivo.

    expect(appService).toBeInstanceOf(AppService);
  });
});
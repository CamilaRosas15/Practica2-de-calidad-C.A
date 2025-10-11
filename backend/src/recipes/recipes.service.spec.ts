import { Test, TestingModule } from '@nestjs/testing';
import { RecipesService } from './recipes.service';
import { SupabaseService } from 'src/supabase/supabase/supabase.service';

describe('RecipesService', () => {
  let service: RecipesService;

  const supabaseMock = {
    getRecetaCompletaById: jest.fn(),
    getUserDetails: jest.fn(),
    listRecetas: jest.fn(),
    getIngredientesPorRecetas: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipesService,
        { provide: SupabaseService, useValue: supabaseMock },
      ],
    }).compile();

    service = module.get<RecipesService>(RecipesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });


 describe('sanitizeLlmAnswer', () => {
    const DEFAULT_ANSWER = 'Encaja con tus gustos y tiempo. Sustituir mayonesa por yogur natural para aligerar.';

    // Caso 1: Input Nulo/Vacío
    it('debe devolver la respuesta por defecto para un input nulo o vacío', () => {
      expect((service as any).sanitizeLlmAnswer(null)).toBe(DEFAULT_ANSWER);
      expect((service as any).sanitizeLlmAnswer('')).toBe(DEFAULT_ANSWER);
    });

    // Caso 2: Eliminar Tags de Pensamiento
    it('debe eliminar las etiquetas <think> y su contenido', () => {
      const input = 'Texto antes <think>El usuario quiere algo rápido.</think> Texto después.';
      const expected = 'Texto antes Texto después.';
      expect((service as any).sanitizeLlmAnswer(input)).toBe(expected);
    });

    // Caso 3: Eliminar Introducciones en Inglés
    it('debe eliminar frases introductorias comunes en inglés', () => {
      const input = 'Okay, based on the preferences, this is a great choice.';
      const expected = 'this is a great choice.';
      expect((service as any).sanitizeLlmAnswer(input)).toBe(expected);
    });

    // Caso 4: Eliminar Meta-Charla en Español
    it('debe eliminar frases introductorias comunes en español', () => {
      const input = 'Veamos, analizando la receta, te recomiendo esta opción.';
      const expected = 'te recomiendo esta opción.';
      expect((service as any).sanitizeLlmAnswer(input)).toBe(expected);
    });

    // Caso 5: Filtrar Líneas de Razonamiento
    it('debe eliminar líneas que contienen lógica interna del LLM', () => {
      const input = 'I should check the calories.\n- Encaje: Es una buena opción.\nNecesito verificar las alergias.';
      const expected = '- Encaje: Es una buena opción.';
      expect((service as any).sanitizeLlmAnswer(input)).toBe(expected);
    });

    // Caso 6: Limitar a 4 Líneas
    it('debe truncar la respuesta a un máximo de 4 líneas', () => {
      const input = 'Línea 1\nLínea 2\nLínea 3\nLínea 4\nLínea 5 que no debe aparecer';
      const expected = 'Línea 1\nLínea 2\nLínea 3\nLínea 4';
      expect((service as any).sanitizeLlmAnswer(input)).toBe(expected);
    });

    // Caso 7: Resultado Vacío post-limpieza
    it('debe devolver la respuesta por defecto si la limpieza resulta en un string vacío', () => {
      const input = 'I should do this\nNecesito hacer esto otro';
      expect((service as any).sanitizeLlmAnswer(input)).toBe(DEFAULT_ANSWER);
    });

    // Caso 8: Camino Exitoso (Limpieza Ligera)
    it('debe limpiar y formatear correctamente una respuesta casi perfecta', () => {
      const input = '  - Encaje: Se ajusta a tu tiempo. \n\n - Sugerencia: ninguna.  ';
      const expected = '- Encaje: Se ajusta a tu tiempo.\n- Sugerencia: ninguna.';
      expect((service as any).sanitizeLlmAnswer(input)).toBe(expected);
    });
  });
});
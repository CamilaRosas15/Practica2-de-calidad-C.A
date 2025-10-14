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
  describe('askOllama', () => {
    const testPrompt = 'Recomienda una receta';

    // Antes de cada test en ESTA suite, nos aseguramos de que 'fetch' sea una función mock
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    // Caso 1: Camino Exitoso
    it('debe devolver el contenido del mensaje en una respuesta exitosa', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          message: { content: '  La mejor receta es la de tacos.  ' },
        }),
      });

      const result = await (service as any).askOllama(testPrompt);
      expect(result).toBe('La mejor receta es la de tacos.');
    });

    // Caso 2: Error de Red
    it('debe lanzar un error si la llamada fetch es rechazada', async () => {
      const networkError = new Error('Failed to fetch');
      (fetch as jest.Mock).mockRejectedValue(networkError);

      await expect((service as any).askOllama(testPrompt)).rejects.toThrow('Failed to fetch');
    });

    // Caso 3: Error de API (HTTP 500)
    it('debe lanzar un error si la respuesta de la API no es "ok"', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      await expect((service as any).askOllama(testPrompt)).rejects.toThrow('Ollama error 500: Internal Server Error');
    });

    // Caso 4: Respuesta Malformada (No es JSON)
    it('debe lanzar un error si el cuerpo de la respuesta no es un JSON válido', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => { throw new Error('Invalid JSON'); },
      });
      
      await expect((service as any).askOllama(testPrompt)).rejects.toThrow('Invalid JSON');
    });

    // Caso 5: Estructura JSON Inesperada
    it('debe devolver un string vacío si la estructura del JSON no contiene message.content', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: 'formato inesperado' }),
      });

      const result = await (service as any).askOllama(testPrompt);
      expect(result).toBe('');
    });

    // Caso 6: Usa Variables de Entorno
    it('debe usar la URL y el modelo de las variables de entorno si están definidas', async () => {
      const originalBaseUrl = process.env.OLLAMA_BASE_URL;
      const originalModel = process.env.OLLAMA_MODEL;
      process.env.OLLAMA_BASE_URL = 'http://test-url.com';
      process.env.OLLAMA_MODEL = 'test-model:latest';
      
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ message: { content: 'ok' } }),
      });

      await (service as any).askOllama(testPrompt);

      expect(fetch).toHaveBeenCalledWith('http://test-url.com/api/chat', expect.any(Object));
      const fetchBody = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
      expect(fetchBody.model).toBe('test-model:latest');

      // Restaurar las variables de entorno para no afectar otros tests
      process.env.OLLAMA_BASE_URL = originalBaseUrl;
      process.env.OLLAMA_MODEL = originalModel;
    });
  });
  describe('getById', () => {
    const RECIPE_ID = 123;
    const RECIPE_MOCK = { id_receta: RECIPE_ID, titulo: 'Receta de Prueba' };

    // Caso 1: Camino Exitoso
    it('debe llamar a supabase.getRecetaCompletaById con el ID correcto y devolver el resultado', async () => {
      supabaseMock.getRecetaCompletaById.mockResolvedValue(RECIPE_MOCK);
      const resultado = await service.getById(RECIPE_ID);
      expect(supabaseMock.getRecetaCompletaById).toHaveBeenCalledTimes(1);
      expect(supabaseMock.getRecetaCompletaById).toHaveBeenCalledWith(RECIPE_ID);
      expect(resultado).toEqual(RECIPE_MOCK);
    });

    // Caso 2: Camino Nulo
    it('debe devolver null si supabase.getRecetaCompletaById devuelve null', async () => {
      supabaseMock.getRecetaCompletaById.mockResolvedValue(null);
      const resultado = await service.getById(RECIPE_ID);
      expect(supabaseMock.getRecetaCompletaById).toHaveBeenCalledWith(RECIPE_ID);
      expect(resultado).toBeNull();
    });
  });
});
import { Test, TestingModule } from '@nestjs/testing';
import { NutrichefAiService } from './nutrichef-ai.service';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

const mockGroqChatCompletionsCreate = jest.fn();
jest.mock('groq-sdk', () => {
  return jest.fn().mockImplementation(() => {
    return {
      chat: {
        completions: {
          create: mockGroqChatCompletionsCreate,
        },
      },
    };
  });
});

describe('NutrichefAiService', () => {
  let service: NutrichefAiService;

  const createServiceWithConfig = async (configValues: Record<string, string | undefined>) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NutrichefAiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => configValues[key]),
          },
        },
      ],
    }).compile();

    return module.get<NutrichefAiService>(NutrichefAiService);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(async () => {
    service = await createServiceWithConfig({});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHelloWorldFromAI', () => {
    // Caso de Prueba 1: Camino Exitoso
    it('debe devolver el saludo de la IA cuando la API key está configurada', async () => {
      service = await createServiceWithConfig({ GROQ_API_KEY: 'una-key-valida' });
      const mockResponse = { choices: [{ message: { content: '¡Hola desde la IA de Groq!' } }] };
      mockGroqChatCompletionsCreate.mockResolvedValue(mockResponse);

      const result = await service.getHelloWorldFromAI();

      expect(mockGroqChatCompletionsCreate).toHaveBeenCalledTimes(1);
      expect(result).toBe('¡Hola desde la IA de Groq!');
    });

    // Caso de Prueba 2: Modo Demo (Sin API Key)
    it('debe devolver el mensaje de demostración si no hay API key', async () => {
      service = await createServiceWithConfig({ GROQ_API_KEY: undefined });

      const result = await service.getHelloWorldFromAI();

      expect(result).toBe("¡Hola! Este es un mensaje de demostración de NutriChef IA. Para usar la IA real, configura tu API key de Groq.");
      expect(mockGroqChatCompletionsCreate).not.toHaveBeenCalled();
    });

    // Caso de Prueba 3: Fallo de la API
    it('debe devolver un mensaje de error si la llamada a la API de Groq falla', async () => {
      service = await createServiceWithConfig({ GROQ_API_KEY: 'una-key-valida' });
      mockGroqChatCompletionsCreate.mockRejectedValue(new Error('Error de red'));

      const result = await service.getHelloWorldFromAI();

      expect(result).toBe('Error: No se pudo conectar con el servicio de IA. Verifica tu API key.');
    });

    // Caso de Prueba 4: Respuesta Inesperada/Vacía (Fallback)
    it('debe devolver un mensaje de fallback si la respuesta de la IA no tiene contenido', async () => {
      service = await createServiceWithConfig({ GROQ_API_KEY: 'una-key-valida' });
      const mockResponse = { choices: [] };
      mockGroqChatCompletionsCreate.mockResolvedValue(mockResponse);

      const result = await service.getHelloWorldFromAI();

      expect(result).toBe('No se pudo obtener el saludo de la IA.');
    });
  });
});
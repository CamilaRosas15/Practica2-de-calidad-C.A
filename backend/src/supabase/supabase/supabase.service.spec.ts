import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from './supabase.service';
import { ConfigService } from '@nestjs/config';
import { PostgrestError } from '@supabase/supabase-js';

describe('SupabaseService', () => {
  let service: SupabaseService;

  const supabaseClientMock = {
    from: jest.fn(),
  };

  beforeEach(async () => {

    const configMock = {
      get: jest.fn((key: string) => {
        if (key === 'SUPABASE_URL') return 'https://fake-url.supabase.co';
        if (key === 'SUPABASE_ANON_KEY') return 'fake-anon-key';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseService,
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<SupabaseService>(SupabaseService);

    (service as any).logger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    (service as any).supabase = supabaseClientMock;
    
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getIngredientesPorRecetas', () => {
    const ERROR_MOCK: PostgrestError = {
        name: 'PostgrestError', message: 'Error de base de datos', details: '', hint: '', code: '123',
    };

    // Caso de Prueba 1: Entrada de IDs de recetas vacía.
    it('debe devolver un Map vacío si el array de recetaIds está vacío', async () => {
      const resultado = await service.getIngredientesPorRecetas([]);
      expect(resultado.size).toBe(0);
      expect(supabaseClientMock.from).not.toHaveBeenCalled();
    });

    // Caso de Prueba 2: No se encuentran enlaces de receta_ingredientes.
    it('debe devolver un Map vacío si no se encuentran enlaces de ingredientes', async () => {
      supabaseClientMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValueOnce({ data: [], error: null }),
      });
      const resultado = await service.getIngredientesPorRecetas([1]);
      expect(resultado.size).toBe(0);
    });

    // Caso de Prueba 3: Error en la consulta a la tabla `receta_ingredientes`.
    it('debe devolver un Map vacío si hay un error al obtener los enlaces', async () => {
      supabaseClientMock.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValueOnce({ data: null, error: ERROR_MOCK }),
      });
      const resultado = await service.getIngredientesPorRecetas([1]);
      expect(resultado.size).toBe(0);
    });

    // Caso de Prueba 4: No se encuentran ingredientes correspondientes.
    it('debe devolver un Map vacío si no se encuentran ingredientes', async () => {
      const enlaces = [{ id_receta: 1, id_ingrediente: 101, cantidad: 100 }];
      supabaseClientMock.from
        .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValueOnce({ data: enlaces, error: null }) })
        .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValueOnce({ data: [], error: null }) });
      const resultado = await service.getIngredientesPorRecetas([1]);
      expect(resultado.size).toBe(0);
    });

    // Caso de Prueba 5: Error en la consulta a la tabla `ingredientes`.
    it('debe devolver un Map vacío si hay un error al obtener los ingredientes', async () => {
      const enlaces = [{ id_receta: 1, id_ingrediente: 101, cantidad: 100 }];
      supabaseClientMock.from
        .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValueOnce({ data: enlaces, error: null }) })
        .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValueOnce({ data: null, error: ERROR_MOCK }) });
      const resultado = await service.getIngredientesPorRecetas([1]);
      expect(resultado.size).toBe(0);
    });

    // Caso de Prueba 6: Un ingrediente de un enlace no se encuentra en el mapa de ingredientes.
    it('debe omitir un ingrediente si no se encuentra en el mapa de ingredientes', async () => {
      const enlaces = [{ id_receta: 1, id_ingrediente: 999, cantidad: 50 }];
      const ingredientes = [{ id_ingrediente: 101, nombre: 'Tomate' }];
      supabaseClientMock.from
        .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValueOnce({ data: enlaces, error: null }) })
        .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValueOnce({ data: ingredientes, error: null }) });
      const resultado = await service.getIngredientesPorRecetas([1]);
      expect(resultado.size).toBe(0);
    });

    // Caso de Prueba 7: La cantidad de un ingrediente es nula.
    it('debe manejar una cantidad nula para un ingrediente', async () => {
      const enlaces = [{ id_receta: 1, id_ingrediente: 101, cantidad: null }];
      const ingredientes = [{ id_ingrediente: 101, nombre: 'Sal' }];
       supabaseClientMock.from
        .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValueOnce({ data: enlaces, error: null }) })
        .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValueOnce({ data: ingredientes, error: null }) });
      const resultado = await service.getIngredientesPorRecetas([1]);
      expect(resultado.get(1)?.[0].cantidad).toBeNull();
    });

    // Caso de Prueba 8: Múltiples recetas con múltiples ingredientes (happy path).
    it('debe devolver un mapa con múltiples recetas y múltiples ingredientes', async () => {
      const enlaces = [ { id_receta: 1, id_ingrediente: 101, cantidad: 2 }, { id_receta: 1, id_ingrediente: 102, cantidad: 200 }, { id_receta: 2, id_ingrediente: 103, cantidad: 1 }];
      const ingredientes = [ { id_ingrediente: 101, nombre: 'Huevo' }, { id_ingrediente: 102, nombre: 'Harina' }, { id_ingrediente: 103, nombre: 'Leche' }];
      supabaseClientMock.from
        .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValueOnce({ data: enlaces, error: null }) })
        .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValueOnce({ data: ingredientes, error: null }) });
      const resultado = await service.getIngredientesPorRecetas([1, 2]);
      expect(resultado.size).toBe(2);
      expect(resultado.get(1)?.length).toBe(2);
      expect(resultado.get(2)?.length).toBe(1);
    });

    // Caso de Prueba 9: Múltiples recetas comparten el mismo ingrediente.
    it('debe manejar múltiples recetas que comparten el mismo ingrediente', async () => {
      const enlaces = [ { id_receta: 1, id_ingrediente: 101, cantidad: 2 }, { id_receta: 2, id_ingrediente: 101, cantidad: 3 }];
      const ingredientes = [{ id_ingrediente: 101, nombre: 'Azúcar' }];
       supabaseClientMock.from
        .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValueOnce({ data: enlaces, error: null }) })
        .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValueOnce({ data: ingredientes, error: null }) });
      const resultado = await service.getIngredientesPorRecetas([1, 2]);
      expect(resultado.size).toBe(2);
      expect(resultado.get(1)?.[0].nombre).toBe('Azúcar');
    });

    // Caso de Prueba 10: Una receta con un ingrediente, y otra receta sin ingredientes encontrados.
    it('debe manejar una mezcla de recetas con y sin ingredientes encontrados', async () => {
      const enlaces = [{ id_receta: 1, id_ingrediente: 101, cantidad: 100 }];
      const ingredientes = [{ id_ingrediente: 101, nombre: 'Pimienta' }];
      supabaseClientMock.from
        .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValueOnce({ data: enlaces, error: null }) })
        .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValueOnce({ data: ingredientes, error: null }) });
      const resultado = await service.getIngredientesPorRecetas([1, 3]);
      expect(resultado.size).toBe(1);
      expect(resultado.has(1)).toBe(true);
      expect(resultado.has(3)).toBe(false);
    });
  });

  describe('getRecetaCompletaById', () => {
    const RECETA_ID = 1;
    const RECETA_BASE = { id_receta: RECETA_ID, nombre: 'Tacos' };
    const ERROR_MOCK: PostgrestError = {
      name: 'PostgrestError', message: 'Error simulado de BD', details: '', hint: '', code: '500',
    };

    // Caso 1: Camino Exitoso - Encuentra receta e ingredientes
    it('debe devolver la receta completa con sus ingredientes', async () => {
      const enlaces = [{ id_ingrediente: 101, cantidad: 2 }];
      const ingredientes = [{ id_ingrediente: 101, nombre: 'Tortilla' }];
      supabaseClientMock.from.mockImplementation((tableName: string) => {
        if (tableName === 'recetas') {
          return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: RECETA_BASE, error: null }) };
        }
        if (tableName === 'receta_ingredientes') {
          return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: enlaces, error: null }) };
        }
        if (tableName === 'ingredientes') {
          return { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: ingredientes, error: null }) };
        }
      });
      const resultado = await service.getRecetaCompletaById(RECETA_ID);
      expect(resultado).not.toBeNull();
      expect(resultado.nombre).toBe('Tacos');
      expect(resultado.ingredientes).toHaveLength(1);
    });

    // Caso 2: Error al buscar la receta base
    it('debe devolver null si la consulta de la receta principal falla', async () => {
      supabaseClientMock.from.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: ERROR_MOCK }),
      }));
      const resultado = await service.getRecetaCompletaById(RECETA_ID);
      expect(resultado).toBeNull();
    });

    // Caso 3: Error al buscar los enlaces de ingredientes
    it('debe devolver la receta base con ingredientes vacíos si la consulta de enlaces falla', async () => {
      supabaseClientMock.from.mockImplementation((tableName: string) => {
        if (tableName === 'recetas') {
          return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: RECETA_BASE, error: null }) };
        }
        if (tableName === 'receta_ingredientes') {
          return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: null, error: ERROR_MOCK }) };
        }
      });
      const resultado = await service.getRecetaCompletaById(RECETA_ID);
      expect(resultado).toEqual({ ...RECETA_BASE, ingredientes: [] });
    });

    // Caso 4: Receta sin ingredientes
    it('debe devolver la receta con ingredientes vacíos si no se encuentran enlaces', async () => {
      supabaseClientMock.from.mockImplementation((tableName: string) => {
        if (tableName === 'recetas') {
          return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: RECETA_BASE, error: null }) };
        }
        if (tableName === 'receta_ingredientes') {
          return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [], error: null }) };
        }
      });
      const resultado = await service.getRecetaCompletaById(RECETA_ID);
      expect(resultado).toEqual({ ...RECETA_BASE, ingredientes: [] });
    });

    // Caso 5: Error al buscar los detalles de los ingredientes
    it('debe devolver la receta con ingredientes vacíos si la consulta de ingredientes falla', async () => {
        const enlaces = [{ id_ingrediente: 101, cantidad: 2 }];
        supabaseClientMock.from.mockImplementation((tableName: string) => {
          if (tableName === 'recetas') {
            return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: RECETA_BASE, error: null }) };
          }
          if (tableName === 'receta_ingredientes') {
            return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: enlaces, error: null }) };
          }
          if (tableName === 'ingredientes') {
            return { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: null, error: ERROR_MOCK }) };
          }
        });
      const resultado = await service.getRecetaCompletaById(RECETA_ID);
      expect(resultado).toEqual({ ...RECETA_BASE, ingredientes: [] });
    });

    // Caso 6: Éxito, pero un ingrediente tiene cantidad nula
    it('debe manejar correctamente una cantidad nula en un ingrediente', async () => {
      const enlaces = [{ id_ingrediente: 101, cantidad: null }];
      const ingredientes = [{ id_ingrediente: 101, nombre: 'Sal' }];
      supabaseClientMock.from.mockImplementation((tableName: string) => {
        if (tableName === 'recetas') {
            return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: RECETA_BASE, error: null }) };
        }
        if (tableName === 'receta_ingredientes') {
            return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: enlaces, error: null }) };
        }
        if (tableName === 'ingredientes') {
            return { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: ingredientes, error: null }) };
        }
      });
      const resultado = await service.getRecetaCompletaById(RECETA_ID);
      expect(resultado.ingredientes[0].cantidad).toBeNull();
    });

    // Caso 7: Enlaces encontrados, pero sin ingredientes correspondientes
    it('debe devolver la receta con ingredientes vacíos si los IDs de ingredientes no se encuentran', async () => {
        const enlaces = [{ id_ingrediente: 101, cantidad: 2 }];
        supabaseClientMock.from.mockImplementation((tableName: string) => {
          if (tableName === 'recetas') {
            return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: RECETA_BASE, error: null }) };
          }
          if (tableName === 'receta_ingredientes') {
            return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: enlaces, error: null }) };
          }
          if (tableName === 'ingredientes') {
            return { select: jest.fn().mockReturnThis(), in: jest.fn().mockResolvedValue({ data: [], error: null }) };
          }
        });
        const resultado = await service.getRecetaCompletaById(RECETA_ID);
        expect(resultado).toEqual({ ...RECETA_BASE, ingredientes: [] });
    });
  });
  
  describe('getRecetaById', () => {
    const RECETA_ID = 5;
    const RECETA_MOCK = { id_receta: RECETA_ID, nombre: 'Sopa de Tomate' };
    const ERROR_MOCK: PostgrestError = {
      name: 'PostgrestError',
      message: 'Receta no encontrada',
      details: '',
      hint: '',
      code: '404',
    };

    // Caso 1: Camino Exitoso
    it('debe devolver los datos de una receta cuando se encuentra', async () => {
      // Simula la cadena de llamadas completa para esta prueba
      supabaseClientMock.from.mockImplementation((tableName: string) => {
        if (tableName === 'recetas') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: RECETA_MOCK, error: null }),
          };
        }
      });

      const resultado = await service.getRecetaById(RECETA_ID);

      expect(resultado).not.toBeNull();
      expect(resultado).toEqual(RECETA_MOCK);
      expect(resultado.nombre).toBe('Sopa de Tomate');
    });

    // Caso 2: Error o Receta no encontrada
    it('debe devolver null si ocurre un error o la receta no se encuentra', async () => {
      // Simula la cadena de llamadas para que devuelva un error
      supabaseClientMock.from.mockImplementation((tableName: string) => {
        if (tableName === 'recetas') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: ERROR_MOCK }),
          };
        }
      });

      const resultado = await service.getRecetaById(RECETA_ID);

      expect(resultado).toBeNull();
    });
  });
});
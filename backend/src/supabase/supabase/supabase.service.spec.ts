import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from './supabase.service';
import { ConfigService } from '@nestjs/config';
import { PostgrestError } from '@supabase/supabase-js';


describe('SupabaseService', () => {
  let service: SupabaseService;

  const supabaseClientMock = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    in: jest.fn(),
  };

  const configMock = {
    get: jest.fn((key: string) => {
      if (key === 'SUPABASE_URL') return 'https://fake-url.supabase.co';
      if (key === 'SUPABASE_ANON_KEY') return 'fake-anon-key';
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

    (service as any).supabase = supabaseClientMock;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });


  describe('getIngredientesPorRecetas', () => {

    // Caso de Prueba 1: Entrada de IDs de recetas vacía.
    it('debe devolver un Map vacío si el array de recetaIds está vacío', async () => {
      const resultado = await service.getIngredientesPorRecetas([]);
      expect(resultado.size).toBe(0);
      expect(supabaseClientMock.from).not.toHaveBeenCalled();
    });

    // Caso de Prueba 2: No se encuentran enlaces de receta_ingredientes.
    it('debe devolver un Map vacío si no se encuentran enlaces de ingredientes', async () => {
      supabaseClientMock.in.mockResolvedValueOnce({ data: [], error: null });
      const resultado = await service.getIngredientesPorRecetas([1]);
      expect(resultado.size).toBe(0);
    });

    // Caso de Prueba 3: Error en la consulta a la tabla `receta_ingredientes`.
    it('debe devolver un Map vacío si hay un error al obtener los enlaces', async () => {
      const error: PostgrestError = {
        name: 'PostgrestError', 
        message: 'Error de base de datos',
        details: '',
        hint: '',
        code: '123',
      };
      supabaseClientMock.in.mockResolvedValueOnce({ data: null, error });
      const resultado = await service.getIngredientesPorRecetas([1]);
      expect(resultado.size).toBe(0);
    });

    // Caso de Prueba 4: No se encuentran ingredientes correspondientes.
    it('debe devolver un Map vacío si no se encuentran ingredientes', async () => {
      supabaseClientMock.in
        .mockResolvedValueOnce({ data: [{ id_receta: 1, id_ingrediente: 101, cantidad: 100 }], error: null })
        .mockResolvedValueOnce({ data: [], error: null });
      const resultado = await service.getIngredientesPorRecetas([1]);
      expect(resultado.size).toBe(0);
    });

    // Caso de Prueba 5: Error en la consulta a la tabla `ingredientes`.
    it('debe devolver un Map vacío si hay un error al obtener los ingredientes', async () => {
      const error: PostgrestError = {
        name: 'PostgrestError', 
        message: 'Error de base de datos',
        details: '',
        hint: '',
        code: '123',
      };
      supabaseClientMock.in
        .mockResolvedValueOnce({ data: [{ id_receta: 1, id_ingrediente: 101, cantidad: 100 }], error: null })
        .mockResolvedValueOnce({ data: null, error });
      const resultado = await service.getIngredientesPorRecetas([1]);
      expect(resultado.size).toBe(0);
    });

    // Caso de Prueba 6: Un ingrediente de un enlace no se encuentra en el mapa de ingredientes.
    it('debe omitir un ingrediente si no se encuentra en el mapa de ingredientes', async () => {
      supabaseClientMock.in
        .mockResolvedValueOnce({ data: [{ id_receta: 1, id_ingrediente: 999, cantidad: 50 }], error: null })
        .mockResolvedValueOnce({ data: [{ id_ingrediente: 101, nombre: 'Tomate' }], error: null });
      const resultado = await service.getIngredientesPorRecetas([1]);
      expect(resultado.size).toBe(0);
    });

    // Caso de Prueba 7: La cantidad de un ingrediente es nula.
    it('debe manejar una cantidad nula para un ingrediente', async () => {
      supabaseClientMock.in
        .mockResolvedValueOnce({ data: [{ id_receta: 1, id_ingrediente: 101, cantidad: null }], error: null })
        .mockResolvedValueOnce({ data: [{ id_ingrediente: 101, nombre: 'Sal' }], error: null });
      const resultado = await service.getIngredientesPorRecetas([1]);
      expect(resultado.get(1)?.[0].cantidad).toBeNull();
    });

    // Caso de Prueba 8: Múltiples recetas con múltiples ingredientes (happy path).
    it('debe devolver un mapa con múltiples recetas y múltiples ingredientes', async () => {
      const enlaces = [
        { id_receta: 1, id_ingrediente: 101, cantidad: 2 },
        { id_receta: 1, id_ingrediente: 102, cantidad: 200 },
        { id_receta: 2, id_ingrediente: 103, cantidad: 1 },
      ];
      const ingredientes = [
        { id_ingrediente: 101, nombre: 'Huevo', unidad: 'unidad' },
        { id_ingrediente: 102, nombre: 'Harina', unidad: 'gramos' },
        { id_ingrediente: 103, nombre: 'Leche', unidad: 'ml' },
      ];
      supabaseClientMock.in
        .mockResolvedValueOnce({ data: enlaces, error: null })
        .mockResolvedValueOnce({ data: ingredientes, error: null });

      const resultado = await service.getIngredientesPorRecetas([1, 2]);
      expect(resultado.size).toBe(2);
      expect(resultado.get(1)?.length).toBe(2);
      expect(resultado.get(2)?.length).toBe(1);
      expect(resultado.get(1)?.[0].nombre).toBe('Huevo');
    });

    // Caso de Prueba 9: Múltiples recetas comparten el mismo ingrediente.
    it('debe manejar múltiples recetas que comparten el mismo ingrediente', async () => {
      const enlaces = [
        { id_receta: 1, id_ingrediente: 101, cantidad: 2 },
        { id_receta: 2, id_ingrediente: 101, cantidad: 3 },
      ];
      const ingredientes = [{ id_ingrediente: 101, nombre: 'Azúcar' }];
      supabaseClientMock.in
        .mockResolvedValueOnce({ data: enlaces, error: null })
        .mockResolvedValueOnce({ data: ingredientes, error: null });

      const resultado = await service.getIngredientesPorRecetas([1, 2]);
      expect(resultado.size).toBe(2);
      expect(resultado.get(1)?.[0].nombre).toBe('Azúcar');
      expect(resultado.get(2)?.[0].nombre).toBe('Azúcar');
      expect(resultado.get(1)?.[0].cantidad).toBe(2);
      expect(resultado.get(2)?.[0].cantidad).toBe(3);
    });

    // Caso de Prueba 10: Una receta con un ingrediente, y otra receta sin ingredientes encontrados.
    it('debe manejar una mezcla de recetas con y sin ingredientes encontrados', async () => {
      // Simula que para los IDs [1, 3], la BBDD solo devuelve enlaces para el ID 1.
      const enlaces = [{ id_receta: 1, id_ingrediente: 101, cantidad: 100 }];
      const ingredientes = [{ id_ingrediente: 101, nombre: 'Pimienta' }];
      supabaseClientMock.in
        .mockResolvedValueOnce({ data: enlaces, error: null })
        .mockResolvedValueOnce({ data: ingredientes, error: null });
      
      const resultado = await service.getIngredientesPorRecetas([1, 3]);
      expect(resultado.size).toBe(1);
      expect(resultado.has(1)).toBe(true);
      expect(resultado.has(3)).toBe(false);
      expect(resultado.get(1)?.[0].nombre).toBe('Pimienta');
    });
  });
});
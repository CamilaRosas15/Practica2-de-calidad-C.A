import { Test, TestingModule } from '@nestjs/testing';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';
import { NotFoundException } from '@nestjs/common';

describe('RecipesController', () => {
  let controller: RecipesController;

  const recipesServiceMock = {
    getById: jest.fn(),
    recomendarReceta: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecipesController],
      providers: [
        { provide: RecipesService, useValue: recipesServiceMock },
      ],
    }).compile();

    controller = module.get<RecipesController>(RecipesController);
    jest.clearAllMocks(); 
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getById', () => {
    // TC 1: Camino Exitoso
    it('debe devolver una receta si se encuentra', async () => {
      const recipeMock = { id_receta: 1, nombre: 'Torta de Chocolate' };
      recipesServiceMock.getById.mockResolvedValue(recipeMock);

      const result = await controller.getById('1');

      expect(recipesServiceMock.getById).toHaveBeenCalledWith(1);
      expect(result).toEqual(recipeMock);
    });

    // TC 2: Receta No Encontrada
    it('debe lanzar NotFoundException si el servicio devuelve null', async () => {
      recipesServiceMock.getById.mockResolvedValue(null);
      await expect(controller.getById('404')).rejects.toThrow(NotFoundException);
      expect(recipesServiceMock.getById).toHaveBeenCalledWith(404);
    });

    // TC 3: ID Inválido
    it('debe lanzar NotFoundException si el ID no es numérico', async () => {
      await expect(controller.getById('abc')).rejects.toThrow(NotFoundException);
      expect(recipesServiceMock.getById).not.toHaveBeenCalled();
    });
  });

  describe('recomendar', () => {
    // TC 1: Camino Exitoso
    it('debe llamar al servicio con el body y devolver su resultado', async () => {
      const requestBody = { gustos: ['pollo'], tiempo_max: 20 };
      const serviceResponse = { opciones: [{ id_receta: 2, titulo: 'Pollo al Horno' }] };

      recipesServiceMock.recomendarReceta.mockResolvedValue(serviceResponse);

      const result = await controller.recomendar(requestBody);

      expect(recipesServiceMock.recomendarReceta).toHaveBeenCalledWith(requestBody);
      expect(result).toEqual(serviceResponse);
    });
  });
});
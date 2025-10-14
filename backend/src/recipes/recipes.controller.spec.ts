import { Test, TestingModule } from '@nestjs/testing';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

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

  describe('recomendar', () => {
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
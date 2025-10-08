import { Test, TestingModule } from '@nestjs/testing';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';

describe('RecipesController', () => {
  let controller: RecipesController;

  const recipesServiceMock = {
    getRecipeById: jest.fn(),
    recomendarRecetas: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecipesController],
      providers: [
        { provide: RecipesService, useValue: recipesServiceMock }, // << mock
      ],
    }).compile();

    controller = module.get<RecipesController>(RecipesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { NutrichefAiController } from './nutrichef-ai.controller';
import { NutrichefAiService } from './nutrichef-ai.service';

describe('NutrichefAiController', () => {
  let controller: NutrichefAiController;

  const aiServiceMock = {
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NutrichefAiController],
      providers: [{ provide: NutrichefAiService, useValue: aiServiceMock }], // << mock
    }).compile();

    controller = module.get<NutrichefAiController>(NutrichefAiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

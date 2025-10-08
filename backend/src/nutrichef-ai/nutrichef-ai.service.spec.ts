import { Test, TestingModule } from '@nestjs/testing';
import { NutrichefAiService } from './nutrichef-ai.service';
import { ConfigService } from '@nestjs/config';

describe('NutrichefAiService', () => {
  let service: NutrichefAiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NutrichefAiService,
        { provide: ConfigService, useValue: { get: jest.fn(() => 'dummy') } }, // << mock
      ],
    }).compile();

    service = module.get<NutrichefAiService>(NutrichefAiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

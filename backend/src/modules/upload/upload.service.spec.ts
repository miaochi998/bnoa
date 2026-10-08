import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { UploadService } from './upload.service';
import { PrismaService } from '../../config/prisma.service';
import { StorageService } from '../storage/storage.service';
import * as crypto from 'crypto';

// Mock crypto
jest.mock('crypto');

describe('UploadService', () => {
  let service: UploadService;
  let prismaService: jest.Mocked<PrismaService>;
  let storageService: jest.Mocked<StorageService>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let _configService: jest.Mocked<ConfigService>;

  const mockUserId = 'user-123';
  const mockSessionId = 'session-123';
  const mockFileId = 'file-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()

              .mockImplementation((key: string, defaultValue: any) => {
                const configs: Record<string, any> = {
                  UPLOAD_MAX_FILE_SIZE: 1073741824,
                  UPLOAD_CHUNK_SIZE: 5242880,
                  UPLOAD_ALLOWED_TYPES: '',
                  UPLOAD_ALLOWED_EXTENSIONS: '',
                  UPLOAD_SESSION_EXPIRE_MINUTES: 1440,
                };

                return configs[key] ?? defaultValue;
              }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            file: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
            },
            uploadSession: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: StorageService,
          useValue: {
            upload: jest.fn(),
            download: jest.fn(),
            delete: jest.fn(),
            getBucketName: jest.fn().mockReturnValue('test-bucket'),
          },
        },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
    prismaService = module.get(PrismaService);
    storageService = module.get(StorageService);
    _configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkFileExists', () => {
    it('should return exists true when file exists for user', async () => {
      const mockFile = {
        id: mockFileId,
        url: 'http://test.com/file.pdf',
      };

      prismaService.file.findFirst = jest.fn().mockResolvedValue(mockFile);

      const result = await service.checkFileExists(
        { md5: 'test-md5', folderId: 'folder-123' },
        mockUserId,
      );

      expect(result.exists).toBe(true);
      expect(result.fileId).toBe(mockFileId);
      expect(result.url).toBe(mockFile.url);
    });

    it('should return exists false when file not found', async () => {
      prismaService.file.findFirst = jest.fn().mockResolvedValue(null);

      const result = await service.checkFileExists(
        { md5: 'test-md5' },
        mockUserId,
      );

      expect(result.exists).toBe(false);
      expect(result.message).toContain('不存在');
    });
  });

  describe('initUpload', () => {
    const initDto = {
      fileName: 'test.pdf',
      fileSize: 1024,
      md5: 'test-md5-hash',
      mimeType: 'application/pdf',
      extension: 'pdf',
      folderId: undefined,
    };

    it('should throw BadRequestException when file size exceeds limit', async () => {
      const largeFileDto = { ...initDto, fileSize: 2 * 1024 * 1024 * 1024 }; // 2GB

      await expect(
        service.initUpload(largeFileDto, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return existing session if found', async () => {
      const existingSession = {
        id: mockSessionId,
        chunkSize: 5242880,
        chunkCount: 1,
        chunks: [
          { index: 0, md5: 'chunk-md5', size: 1024, uploadedAt: new Date() },
        ],
        status: 'UPLOADING',
      };

      prismaService.file.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.uploadSession.findFirst = jest
        .fn()
        .mockResolvedValue(existingSession);

      const result = await service.initUpload(initDto, mockUserId);

      expect(result.sessionId).toBe(mockSessionId);
      expect(result.uploadedChunks).toContain(0);
    });

    it('should create new session when no existing session', async () => {
      const newSession = {
        id: mockSessionId,
        chunkSize: 5242880,
        chunkCount: 1,
        uploadedChunks: 0,
        status: 'PENDING',
      };

      prismaService.file.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.uploadSession.findFirst = jest.fn().mockResolvedValue(null);
      prismaService.uploadSession.create = jest
        .fn()
        .mockResolvedValue(newSession);

      const result = await service.initUpload(initDto, mockUserId);

      expect(result.sessionId).toBe(mockSessionId);
      expect(result.uploadedChunks).toEqual([]);

      expect(prismaService.uploadSession.create).toHaveBeenCalled();
    });
  });

  describe('uploadChunk', () => {
    const mockBuffer = Buffer.from('test chunk data');

    it('should throw NotFoundException when session not found', async () => {
      prismaService.uploadSession.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        service.uploadChunk(mockSessionId, 0, 'md5', mockBuffer, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when session already completed', async () => {
      prismaService.uploadSession.findFirst = jest.fn().mockResolvedValue({
        id: mockSessionId,
        status: 'COMPLETED',
        chunkCount: 5,
        uploadedChunks: 5,
      });

      await expect(
        service.uploadChunk(mockSessionId, 0, 'md5', mockBuffer, mockUserId),
      ).rejects.toThrow(ConflictException);
    });

    it('should upload chunk successfully', async () => {
      const chunkData = 'test chunk data';
      const mockBuffer = Buffer.from(chunkData);
      const mockSession = {
        id: mockSessionId,
        status: 'UPLOADING',
        chunkCount: 1,
        uploadedChunks: 0,
        chunks: [],
        fileSize: BigInt(chunkData.length),
        chunkSize: chunkData.length,
      };

      prismaService.uploadSession.findFirst = jest
        .fn()
        .mockResolvedValue(mockSession);
      prismaService.uploadSession.update = jest.fn().mockResolvedValue({
        ...mockSession,
        uploadedChunks: 1,
      });
      storageService.upload = jest.fn().mockResolvedValue(undefined);

      // Mock crypto.createHash
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('correct-md5'),
      };
      (crypto.createHash as jest.Mock).mockReturnValue(mockHash);

      const result = await service.uploadChunk(
        mockSessionId,
        0,
        'correct-md5',
        mockBuffer,
        mockUserId,
      );

      expect(result.success).toBe(true);

      expect(storageService.upload).toHaveBeenCalled();
    });
  });

  describe('completeUpload', () => {
    it('should throw NotFoundException when session not found', async () => {
      prismaService.uploadSession.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        service.completeUpload({ sessionId: mockSessionId }, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when chunks not fully uploaded', async () => {
      prismaService.uploadSession.findFirst = jest.fn().mockResolvedValue({
        id: mockSessionId,
        status: 'UPLOADING',
        chunkCount: 5,
        uploadedChunks: 3,
        fileMd5: 'file-md5',
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        extension: 'pdf',
        fileSize: BigInt(1024),
        folderId: null,
        chunks: [],
        storageType: 'RUSTFS',
      });

      await expect(
        service.completeUpload({ sessionId: mockSessionId }, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelUpload', () => {
    it('should throw NotFoundException when session not found', async () => {
      prismaService.uploadSession.findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        service.cancelUpload(mockSessionId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should cancel upload successfully', async () => {
      prismaService.uploadSession.findFirst = jest.fn().mockResolvedValue({
        id: mockSessionId,
        status: 'UPLOADING',
        chunks: [],
      });
      prismaService.uploadSession.update = jest.fn().mockResolvedValue({
        id: mockSessionId,
        status: 'FAILED',
      });

      await service.cancelUpload(mockSessionId, mockUserId);

      expect(prismaService.uploadSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });
  });

  describe('uploadSingleFile', () => {
    const mockFile = {
      fieldname: 'file',
      originalname: 'test.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('test file content'),
    };

    it('should throw BadRequestException when file size exceeds limit', async () => {
      const largeFile = { ...mockFile, size: 2 * 1024 * 1024 * 1024 };

      await expect(
        service.uploadSingleFile(largeFile, undefined, undefined, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use rapid upload when file exists', async () => {
      const existingFile = {
        id: mockFileId,
        storageType: 'RUSTFS',
        bucket: 'test-bucket',
        path: 'files/test.pdf',
        url: 'http://test.com/test.pdf',
      };

      prismaService.file.findFirst = jest.fn().mockResolvedValue(existingFile);
      prismaService.file.findUnique = jest.fn().mockResolvedValue(existingFile);
      prismaService.file.create = jest.fn().mockResolvedValue({
        id: 'new-file-id',
        name: mockFile.originalname,
        originalName: mockFile.originalname,
        url: existingFile.url,
        size: mockFile.size,
        mimeType: mockFile.mimetype,
        extension: 'pdf',
        createdAt: new Date(),
      });

      // Mock crypto.createHash
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('file-md5'),
      };
      (crypto.createHash as jest.Mock).mockReturnValue(mockHash);

      const result = await service.uploadSingleFile(
        mockFile,
        undefined,
        undefined,
        mockUserId,
      );

      expect(result.isRapidUpload).toBe(true);
    });
  });

  describe('getUploadConfig', () => {
    it('should return upload config', () => {
      const config = service.getUploadConfig();

      expect(config).toBeDefined();
      expect(config.chunkSize).toBe(5242880);
      expect(config.sessionExpireMinutes).toBe(1440);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

describe('StorageService', () => {
  let service: StorageService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let _configService: ConfigService;
  let mockS3Client: { send: jest.Mock };

  const mockConfig: Record<string, string> = {
    RUSTFS_ENDPOINT: 's3.example.com',
    RUSTFS_PORT: '16660',
    RUSTFS_USE_SSL: 'false',
    RUSTFS_ACCESS_KEY: 'test-access-key',
    RUSTFS_SECRET_KEY: 'test-secret-key',
    RUSTFS_BUCKET_NAME: 'test-bucket',
    RUSTFS_REGION: 'us-east-1',
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock S3Client
    mockS3Client = {
      send: jest.fn(),
    };

    (S3Client as jest.MockedClass<typeof S3Client>).mockImplementation(
      () => mockS3Client as any,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              return mockConfig[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    _configService = module.get<ConfigService>(ConfigService);

    // Initialize the service
    service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should initialize S3 client with correct config', () => {
      expect(S3Client).toHaveBeenCalledWith({
        endpoint: 'http://s3.example.com:16660',
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
        forcePathStyle: true,
      });
    });
  });

  describe('upload', () => {
    it('should upload file successfully', async () => {
      const buffer = Buffer.from('test content');
      const key = 'test/file.txt';
      const mimeType = 'text/plain';
      const mockEtag = '"abc123"';

      mockS3Client.send.mockResolvedValueOnce({
        ETag: mockEtag,
        $metadata: { httpStatusCode: 200 },
      });

      const result = await service.upload(buffer, key, mimeType);

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(PutObjectCommand),
      );
      expect(result).toContain('s3.example.com:16660');
      expect(result).toContain('test-bucket');
      expect(result).toContain(key);
    });

    it('should throw error when upload fails', async () => {
      const buffer = Buffer.from('test content');
      const key = 'test/file.txt';
      const mimeType = 'text/plain';

      mockS3Client.send.mockRejectedValueOnce(new Error('Upload failed'));

      await expect(service.upload(buffer, key, mimeType)).rejects.toThrow(
        '文件上传失败',
      );
    });
  });

  describe('uploadWithResult', () => {
    it('should upload file and return detailed result', async () => {
      const buffer = Buffer.from('test content');
      const key = 'test/file.txt';
      const mimeType = 'text/plain';

      mockS3Client.send.mockResolvedValueOnce({
        ETag: '"abc123"',
        $metadata: { httpStatusCode: 200 },
      });

      const result = await service.uploadWithResult(buffer, key, mimeType);

      expect(result).toEqual({
        url: expect.stringContaining(key),

        key,

        size: buffer.length,
        contentType: mimeType,
      });
    });
  });

  describe('download', () => {
    it('should download file successfully', async () => {
      const key = 'test/file.txt';
      const fileContent = Buffer.from('downloaded content');

      // Create a mock readable stream

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield fileContent;
        },
      };

      mockS3Client.send.mockResolvedValueOnce({
        Body: mockStream,
        ContentType: 'text/plain',
        ContentLength: fileContent.length,
        $metadata: { httpStatusCode: 200 },
      });

      const result = await service.download(key);

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(GetObjectCommand),
      );
      expect(result).toEqual(fileContent);
    });

    it('should throw error when file not found', async () => {
      const key = 'nonexistent/file.txt';

      mockS3Client.send.mockRejectedValueOnce({
        name: 'NoSuchKey',
        $metadata: { httpStatusCode: 404 },
      });

      await expect(service.download(key)).rejects.toThrow('文件下载失败');
    });
  });

  describe('delete', () => {
    it('should delete file successfully', async () => {
      const key = 'test/file.txt';

      mockS3Client.send.mockResolvedValueOnce({
        $metadata: { httpStatusCode: 204 },
      });

      await service.delete(key);

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(DeleteObjectCommand),
      );
    });

    it('should throw error when delete fails', async () => {
      const key = 'test/file.txt';

      mockS3Client.send.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(service.delete(key)).rejects.toThrow('文件删除失败');
    });
  });

  describe('getPresignedUrl', () => {
    it('should generate presigned URL with default expiration', async () => {
      const key = 'test/file.txt';
      const mockUrl = 'http://presigned-url/test';

      (getSignedUrl as jest.Mock).mockResolvedValueOnce(mockUrl);

      const result = await service.getPresignedUrl(key);

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(GetObjectCommand),
        { expiresIn: 3600 },
      );
      expect(result).toBe(mockUrl);
    });

    it('should generate presigned URL with custom expiration', async () => {
      const key = 'test/file.txt';
      const expiresIn = 7200;
      const mockUrl = 'http://presigned-url/test';

      (getSignedUrl as jest.Mock).mockResolvedValueOnce(mockUrl);

      const result = await service.getPresignedUrl(key, expiresIn);

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(GetObjectCommand),
        { expiresIn },
      );
      expect(result).toBe(mockUrl);
    });

    it('should throw error when generating URL fails', async () => {
      const key = 'test/file.txt';

      (getSignedUrl as jest.Mock).mockRejectedValueOnce(
        new Error('Generate URL failed'),
      );

      await expect(service.getPresignedUrl(key)).rejects.toThrow(
        '预签名URL生成失败',
      );
    });
  });

  describe('exists', () => {
    it('should return true when file exists', async () => {
      const key = 'test/file.txt';

      mockS3Client.send.mockResolvedValueOnce({
        ContentLength: 100,
        $metadata: { httpStatusCode: 200 },
      });

      const result = await service.exists(key);

      expect(mockS3Client.send).toHaveBeenCalledWith(
        expect.any(HeadObjectCommand),
      );
      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      const key = 'nonexistent/file.txt';

      mockS3Client.send.mockRejectedValueOnce({
        name: 'NotFound',
        $metadata: { httpStatusCode: 404 },
      });

      const result = await service.exists(key);

      expect(result).toBe(false);
    });

    it('should throw error for other errors', async () => {
      const key = 'test/file.txt';

      mockS3Client.send.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.exists(key)).rejects.toThrow('检查文件存在性失败');
    });
  });

  describe('getMetadata', () => {
    it('should return file metadata', async () => {
      const key = 'test/file.txt';
      const mockMetadata = {
        ContentLength: 1000,
        LastModified: new Date('2024-01-01'),
        ContentType: 'text/plain',
        ETag: '"abc123"',
      };

      mockS3Client.send.mockResolvedValueOnce({
        ...mockMetadata,
        $metadata: { httpStatusCode: 200 },
      });

      const result = await service.getMetadata(key);

      expect(result).toEqual({
        size: mockMetadata.ContentLength,
        lastModified: mockMetadata.LastModified,
        contentType: mockMetadata.ContentType,
        etag: mockMetadata.ETag,
      });
    });

    it('should throw error when getting metadata fails', async () => {
      const key = 'test/file.txt';

      mockS3Client.send.mockRejectedValueOnce(new Error('Metadata failed'));

      await expect(service.getMetadata(key)).rejects.toThrow(
        '获取文件元数据失败',
      );
    });
  });

  describe('getConfig', () => {
    it('should return storage config', () => {
      const config = service.getConfig();

      expect(config).toMatchObject({
        endpoint: 's3.example.com',
        useSSL: false,
        accessKey: 'test-access-key',
        secretKey: 'test-secret-key',
        bucketName: 'test-bucket',
        region: 'us-east-1',
      });
      expect(config.port).toBeDefined();
    });
  });

  describe('getBucketName', () => {
    it('should return bucket name', () => {
      const bucketName = service.getBucketName();

      expect(bucketName).toBe('test-bucket');
    });
  });
});

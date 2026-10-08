/**
 * Multer 文件接口
 * 用于类型定义
 */
export interface MulterFile {
  /** 文件名 */
  fieldname: string;
  /** 上传时的文件名 */
  originalname: string;
  /** 文件编码 */
  encoding: string;
  /** MIME类型 */
  mimetype: string;
  /** 文件大小（字节） */
  size: number;
  /** 文件内容 */
  buffer: Buffer;
}

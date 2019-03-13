import { Moment } from 'moment';

export interface IZuFileEntry {
  id: string;
  slugs: string[];
  basePath: string;
  relativePath: string;
  absolutePath: string;
  extname: string;
  basename: string;
  basenameNoExt: string;
  isDirectory: boolean;
  isFile: boolean;
  size: number;
  created: Moment;
  updated: Moment;
  mimeType: string;
}

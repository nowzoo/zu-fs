import * as fs from 'fs-extra';
import * as mime from 'mime';
import moment from 'moment';
import * as path from 'path';

import { ID_SEPARATOR } from './constants';
import { IZuFileEntry } from './file-entry.interface';

export const createFileEntry = (basePath: string, relativePath: string, stats: fs.Stats): IZuFileEntry => {
  const slugs = relativePath.split(path.sep);
  const extname = path.extname(relativePath);
  const abspath = path.resolve(basePath, relativePath);

  return {
    slugs: slugs,
    id: slugs.join(ID_SEPARATOR),
    basePath: basePath,
    relativePath: relativePath,
    absolutePath: abspath,
    extname: extname,
    basename: path.basename(relativePath),
    basenameNoExt: path.basename(relativePath, extname),
    isDirectory: stats.isDirectory(),
    isFile: stats.isFile(),
    size: stats.size,
    created: moment(stats.birthtime),
    updated: moment(stats.mtime),
    mimeType: mime.getType(abspath),
  };

}

import { Observable } from 'rxjs';
import { IZuFileEntry } from './file-entry.interface';

export interface IZuDirectory {
  absolutePath: string;
  entries$: Observable<IZuFileEntry[]>;
  resume(): void;
  stop(): void;
  write(slugs: string[], contents: string | Buffer | Uint8Array): Promise<void>;
  mkdir(slugs: string[]): Promise<void>;
  remove(slugs: string[]): Promise<void>;
  read(slugs: string[]): Promise<Buffer>;
  read$(slugs: string[]): Observable<Buffer|Error>;
  entry$(slugs: string[]): Observable<IZuFileEntry>;
  childrenOf$(slugs: string[]): Observable<IZuFileEntry[]>;
  descendantsOf$(slugs: string[]): Observable<IZuFileEntry[]>;
  parentOf$(slugs: string[]): Observable<IZuFileEntry>;
  ancestorsOf$(slugs: string[]): Observable<IZuFileEntry[]>;
  search$(query: RegExp, extensions?: string[], within?: string[], onlyChildren?: boolean): Observable<IZuFileEntry[]>;
}

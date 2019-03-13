import * as chokidar from 'chokidar';
import * as fs from 'fs-extra';
import * as path from 'path';

import { BehaviorSubject, Observable, of, from, combineLatest } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ID_SEPARATOR } from './constants';
import { createFileEntry } from './create-file-entry';
import { IZuDirectory } from './directory.interface';
import { IZuFileEntry } from './file-entry.interface';

export class ZuDirectory implements IZuDirectory {

  get absolutePath(): string {
    return this._absolutePath;
  }

  get entries$(): Observable<IZuFileEntry[]> {
    return this._entries$.asObservable();
  }

  get stopped(): boolean {
    return this._stopped;
  }

  private _absolutePath: string;
  private _entries$: BehaviorSubject<IZuFileEntry[]>;
  private _entries: Map<string, IZuFileEntry>;
  private _watcher: chokidar.FSWatcher = null;
  private _stopped = true;

  constructor(absolutePath: string) {
    this._absolutePath = absolutePath;
    this._entries = new Map();
    this._entries$ = new BehaviorSubject([]);
    this.resume();
  }

  public write(slugs: string[], contents: string | Buffer | Uint8Array): Promise<void> {
    return fs.outputFile(this.getFileAbsolutePath(slugs), contents);
  }

  public mkdir(slugs: string[]): Promise<void> {
    return fs.ensureDir(this.getFileAbsolutePath(slugs));
  }

  public remove(slugs: string[]): Promise<void> {
    return fs.remove(this.getFileAbsolutePath(slugs));
  }

  public read(slugs: string[]): Promise<Buffer> {
    const fp = this.getFileAbsolutePath(slugs);
    return fs.readFile(fp);
  }



  public read$(slugs: string[]): Observable<Buffer> {
    return this.entry$(slugs)
      .pipe(switchMap((entry: IZuFileEntry) => {
        if (! entry) {
          return of(null);
        }
        return from(this.read(slugs));
      }));
  }

  public entry$(slugs: string[]): Observable<IZuFileEntry> {
    const id = slugs.join(ID_SEPARATOR);
    return this.entries$
      .pipe(map((entries: IZuFileEntry[]) => {
        return entries.find((entry: IZuFileEntry) => id === entry.id) || null;
      }));
  }

  public descendantsOf$(slugs: string[]): Observable<IZuFileEntry[]> {
    const idMatch = slugs.join(ID_SEPARATOR) + ID_SEPARATOR;
    return this.entries$
      .pipe(map((entries: IZuFileEntry[]) => {
        return entries.filter((entry: IZuFileEntry) => {
          entry.id.indexOf(idMatch) === 0;
        });
      }));
  }

  public childrenOf$(slugs: string[]): Observable<IZuFileEntry[]> {
    const slugsMatchLength = slugs.length + 1;
    return this.descendantsOf$(slugs)
      .pipe(map((entries: IZuFileEntry[]) => {
        return entries.filter((entry: IZuFileEntry) => {
          entry.slugs.length === slugsMatchLength;
        });
      }));
  }

  public ancestorsOf$(slugs: string[]): Observable<IZuFileEntry[]> {
    return combineLatest(this.entry$(slugs), this.entries$)
      .pipe(map((results: [IZuFileEntry, IZuFileEntry[]]) => {
        const entry: IZuFileEntry = results[0];
        const entries: IZuFileEntry[] = results[1];
        if (! entry) {
          return [];
        }
        const ancestors: IZuFileEntry[] = [];
        const parentSlugs = entry.slugs.slice(0);
        while ( parentSlugs.length > 0 ) {
          parentSlugs.pop();
          if (parentSlugs.length > 0) {
            const parentId = parentSlugs.join(ID_SEPARATOR);
            const parent = entries.find((parentEntry) => parentId === parentEntry.id) || null;
            if (parent) {
              ancestors.unshift(parent);
            }
          }
        }
        return ancestors;
      }));
  }


  public parentOf$(slugs: string[]): Observable<IZuFileEntry> {
    return this.ancestorsOf$(slugs)
      .pipe(map((ancestors: IZuFileEntry[]) => {
        if (ancestors.length === 0) {
          return null;
        }
        return ancestors[ancestors.length - 1];
      }));
  }

  /**
   * Search for content matches
   * @param  query        The pattern to search for.
   * @param  extensions   Constrain the search to files with these extensions.
   *                      Default null (all files will be read,) but recommended if
   *                      you know what kind(s) of file you have.
   * @param  within       Constrain the results to a subdirectory.
   *                      Default null.
   * @param  onlyChildren If within is specified, whether to limit the results to
   *                      direct children of the subdirectory. Default false.
   * @return              An observable of the file entries that match.
   */
  public search$(query: RegExp, extensions: string[] = null, within: string[] = null, onlyChildren?: boolean): Observable<IZuFileEntry[]> {
    let srcObservable$: Observable<IZuFileEntry[]> = this.entries$;
    if (Array.isArray(within) && within.length > 0) {
      srcObservable$ = onlyChildren === true ? this.childrenOf$(within) : this.descendantsOf$(within);
    }
    return srcObservable$
      .pipe(map((entries: IZuFileEntry[]) => {
        return entries.filter((entry: IZuFileEntry) => {
          return entry.isFile;
        });
      }))
      .pipe(map((entries: IZuFileEntry[]) => {
        if (! Array.isArray(extensions)) {
          return entries;
        }
        if (0 === extensions.length) {
          return entries;
        }
        return entries.filter((entry: IZuFileEntry) => {
          return extensions.indexOf(entry.extname) !== -1;
        });
      }))
      .pipe(switchMap((entries: IZuFileEntry[]) => {
        return from(this.matchEntriesByContent(entries, query));
      }));

  }

  public stop() {
    if (this.stopped) {
      return;
    }
    this._watcher.close();
    this._watcher = null;
    this._stopped = true;
  }

  public resume() {
    if (! this.stopped) {
      return;
    }

    this._watcher = chokidar.watch('.', {
      cwd: this.absolutePath,
      ignored: /(^|[\/\\])\../,
      alwaysStat: true
    });
    this._watcher.on('add', (relativePath: string, stats: fs.Stats) => {
      this._entries.set(relativePath, createFileEntry(this.absolutePath, relativePath, stats));
      this.next();
    });
    this._watcher.on('addDir', (relativePath: string, stats: fs.Stats) => {
      this._entries.set(relativePath, createFileEntry(this.absolutePath, relativePath, stats));
      this.next();
    });
    this._watcher.on('change', (relativePath: string, stats: fs.Stats) => {
      this._entries.set(relativePath, createFileEntry(this.absolutePath, relativePath, stats));
      this.next();
    });
    this._watcher.on('unlink', (relativePath: string) => {
      this._entries.delete(relativePath);
      this.next();
    });
    this._watcher.on('unlinkDir', (relativePath: string) => {
      this._entries.delete(relativePath);
      this.next();
    });
  }

  private next() {
    const arr: IZuFileEntry[] = [];
    this._entries.forEach((value: IZuFileEntry) => arr.push(value));
    this._entries$.next(arr);
  };

  private getFileAbsolutePath(slugs: string[]): string {
    return path.join(this.absolutePath, ...slugs);
  }

  private async matchEntriesByContent(entries: IZuFileEntry[], query: RegExp): Promise<IZuFileEntry[]> {
    const matchedEntries: IZuFileEntry[] = [];
    const entriesToRead = entries.slice(0);
    while (entriesToRead.length > 0) {
      const entry = entriesToRead.shift();
      try {
        const b = await this.read(entry.slugs);
        const str = b.toString();
        if (query.test(str)) {
          matchedEntries.push(entry);
        }
      } catch (e) {}

    }
    return matchedEntries;
  }


}

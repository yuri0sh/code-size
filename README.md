<img alt="Display of file size" src="images/b.png" width="260px" />

A simple yet astonishingly helpful extension for VS Code and GitHub.
Particularly useful for building familiarity with project contents.

## Motivation

There are many extensions like this. Why make a new one?

What makes this one unique is its compatibility with Remote Repositories and browser vscodium editors.  
The main goal was to be able to open any repo in [github.dev](https://github.dev) (hotkey: `.` on the repos page) and get a quick overview of the entire project.

Files and folders that are more important tend to be larger in size. You can get a good heuristic of what the repository is all about just by looking at it topologically, without spending much time manually going through the files or having to download it.

<sub>should be a github feature tbh</sub>

## Features

* Folder view, grouped by extension view, flat file view, sorted by total size

* Cumulative folder file count

* Powerful select / filter system
  
  Select files, folders and extensions to ignore, exclude paths with regex, blacklist them, whitelist them, via UI or with JSON, or never touch this feature, doesn't matter, it's there

* Works with __remote repositories__

* Works in browser __[github.dev](https://github.dev)__ and __[vscode.dev](https://github.dev)__ (and other codium editors)

* In theory, supports any resource protocol / virtual file system provided by other extensions

## Settings

* `size.folderContentCount` - toggle file count for folders

* `size.compactFolders` - flatten folders that only contain one child

* `size.defaultTreeType` - sets default "View As..."

* `size.foldersFirst` - gives priority to folders when sorting even if folders are smaller than files

* `size.fileSizeUnits` - toggle between base-2 (Windows, ISO/IEC 80000-13) and base-10 (SI) file size units

* `size.fileSizeLabel` - whether to show file sizes as labels or as descriptions in a tree view

## Coming soon

More advanced filtering options

Similar explorer for document symbols size (à la document outline view), but count lines instead

Options to view and sort by file change rate, as reported by git log -- (inspired by [File Change Count](https://marketplace.visualstudio.com/items?itemName=sivakar12.file-change-count))

## Known Issues 

Files stored with Git LFS are not counted properly (worth parsing .gitattributes over?)

GitHub remote repositories are limited to 100,000 files (GitHub API limitation)

**Enjoy!**

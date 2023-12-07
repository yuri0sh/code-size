<img alt="Display of file size" src="images/b.png" width="260px" />

A simple yet astonishingly helpful extension for VS Code and GitHub.
Particularly useful for building familiarity with new projects.

## Usage

 Works in all classic scenarios. There's many extensions like this. Why make a new one?

What's unique is this extension is compatible with Remote Repositories and browser built vscodium editors.  
The main goal was to be able to open any repo in [github.dev](https://github.dev) (hotkey: `.` on the repos page) to get a quick overview of the entire project.

Files and folders that are more important tend to be larger in size. That means you can get a good heuristic of what the repository is all about without spending time going through the files manually or having to download it. <sup>should be a github feature tbh</sup>

## Features

* Cumulative file count for folders

* Aggregate by file extension

* Works with __remote repositories__

* Works in __[github.dev](https://github.dev)__ and __[vscode.dev](https://github.dev)__ (and other code™ editors)

* Exclude paths with regex (via `Size: Add ignore pattern` command), select files and folders to ignore, blacklist them, whitelist them, never touch this feature, doesn't matter, it's there

* In theory, supports any resource protocol provided by other extensions

## Settings

* `size.fileSizeLabel` - whether to show file sizes as labels or as descriptions in a tree view

* `size.folderContentCount` - adds cumulative file count to folder labels

* `size.compactFolders` - flatten folders that only contain one child

* `size.defaultTreeType` - sets default "View As..."

## Coming soon

Similar explorer for document symbols size (à la document outline view), but count lines instead

Options to view and sort by file change rate, as reported by git log -- (inspired by [File Change Count](https://marketplace.visualstudio.com/items?itemName=sivakar12.file-change-count))

## Known Issues 

Files stored with Git LFS are not counted properly (worth parsing .gitattributes over?)

GitHub remote repositories are limited to 100,000 files (GitHub API limitation)

**Enjoy!**

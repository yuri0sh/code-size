<img alt="Display of file size" src="images/b.png" width="260px" />

A simple yet astonishingly helpful extension for VS Code, GitHub and your overalls capabilities.   
It is particularly useful when exploring little- and un-familiar projects. 

## Usage

Works in all classic scenarios. 

What makes it unique is its compatibility with web editors and Remote Repositories.  
The main goal was to be able to open any repo in [github.dev](https://github.dev) (hotkey: `.` on its GitHub page) and get a quick overview of the entire project.  

This way you can get a heuristic of what the repository is all about without spending time going through the files manually or having to download it. <sub>should be a github feature tbh</sub>

## Features

* Workspace file size tree / list

* Cumulative file count for folders

* Works with __remote repositories__

* Works in __[github.dev](https://github.dev)__ and __[vscode.dev](https://github.dev)__ (and other code™ editors)

* Experimental .gitignore support

* In theory, supports any resource protocols provided by other extensions

## Settings

* `size.fileSizeLabel` - toggles between having file size as primary or secondary label, indicative of how much you value size

* `filesize.folderContentCount` - adds file cumulative count to folder names

## Coming soon

Similar explorer for document symbols size (à la document outline view), but count lines instead

Options to view and sort by file change rate, as reported by git log -- (inspired by [File Change Count](https://marketplace.visualstudio.com/items?itemName=sivakar12.file-change-count))

## Known Issues 

Breaks when run with `npx @vscode/test-web --extensionDevelopmentPath=. .` and file names contain spaces (vs code bug?)

**Enjoy!**

# lavi-vscode extension

This extensions provides syntax highlight, definitions navigation and build and run features for applications written in lavi language.

## Building
```sh
	vsce package --allow-missing-repository
```

## Installing
```sh
	code --install-extension lavi-0.1.2.vsix
```

## Dependencies
```sh
	nvm use v21.1.0
	npm install -g @vscode/vsce
```
[Lavi](https://github.com/andrey-moura/lavi)
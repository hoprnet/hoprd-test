{
  description = "Hoprd test dev shell";

  inputs.flake-utils.url = "github:numtide/flake-utils";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem
      (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          k6-custom = import (toString ./k6-custom.nix) { inherit pkgs; };
        in
        {
          devShells.default = pkgs.callPackage ./shell.nix { 
            inherit pkgs k6-custom;
          };
        }
      );
}
{
  description = "Hoprd test dev shell";

  inputs.flake-utils.url = "github:numtide/flake-utils";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem
      (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          k6-custom = pkgs.callPackage ./k6-custom.nix {};
          k6-webpack = pkgs.callPackage ./k6-webpack.nix { 
            nodejs = pkgs.nodejs_20;
            yarn = pkgs.yarn;
          };
        in
        {
          devShells.default = import ./shell.nix {
            inherit pkgs k6-custom;
          };
          
          packages = {
            build-k6 = k6-custom;
            build = k6-webpack;
            default = k6-custom;
          };
        }
      );
}
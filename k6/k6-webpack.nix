{ pkgs, nodejs, yarn, k6-custom }:

let
  # Get the current directory path
  src = ./.;

in
pkgs.stdenv.mkDerivation rec {
  name = "k6-webpack";

  inherit src;

  nativeBuildInputs = [
    nodejs
    yarn
  ];
  
  buildPhase = ''
    yarn install --frozen-lockfile
    yarn run webpack
  '';

  installPhase = ''
    # Create output directory
    mkdir -p $out
    cp -r dist/* $out/    
  '';

  meta = with pkgs.lib; {
    description = "k6 JavaScript project built with webpack";
    homepage = "https://k6.io";
    license = licenses.mit;
    platforms = [ "aarch64-darwin" "aarch64-linux" "x86_64-linux" ];
  };
}
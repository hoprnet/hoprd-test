{ pkgs, nodejs }:

let
  # Get the current directory path
  src = ./.;
  yarn = pkgs.nodePackages.yarn;

in
pkgs.stdenv.mkDerivation rec {
  name = "k6-webpack";

  inherit src;

  nativeBuildInputs = [
    nodejs
    yarn
    pkgs.cacert
  ];
  
  buildPhase = ''
    export NODE_EXTRA_CA_CERTS=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt
    export YARN_RC_FILENAME=$PWD/.yarnrc
    export YARN_CACHE_FOLDER=$PWD/.yarn-cache
    export HOME=$PWD
    yarn install --frozen-lockfile --network-timeout 60000
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
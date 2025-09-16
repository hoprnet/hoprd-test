{ pkgs, lib, stdenv, buildGoModule, fetchFromGitHub, xk6 }:

let
  k6Version = "1.2.3";
  extensions = [
    "github.com/grafana/xk6-output-prometheus-remote@latest"
    "github.com/NAlexandrov/xk6-tcp@latest"
    "github.com/hoprnet/xk6-udp@latest"
  ];

  platformSettings = {
    "aarch64-darwin" = {
      GOOS = "darwin";
      GOARCH = "arm64";
    };
    "aarch64-linux" = {
      GOOS = "linux";
      GOARCH = "arm64";
    };
    "x86_64-linux" = {
      GOOS = "linux";
      GOARCH = "amd64";
    };
  };

  system = pkgs.system;
  settings = platformSettings.${system} or {
    GOOS = "linux";
    GOARCH = "amd64";
  };
  in
  # Build k6 with extensions using xk6
  stdenv.mkDerivation rec {
    pname = "k6-custom";
    version = "${k6Version}+extensions";

    nativeBuildInputs = [
      pkgs.xk6
      pkgs.go
      pkgs.git

    ];

    GOOS = settings.GOOS;
    GOARCH = settings.GOARCH;
    CGO_ENABLED = "0";

    dontUnpack = true;

    buildPhase = ''
      # Set up proper Go environment
      export GOPATH="/tmp/go"
      export GOCACHE="/tmp/go-build"
      export GO111MODULE="on"
      
      # Create necessary directories
      mkdir -p "$GOPATH" "$GOCACHE"
      
      echo "Building k6 for ${GOOS}/${GOARCH} with extensions: ${toString extensions}"
      
      # Build k6 with all extensions
      xk6 build \
        ${lib.concatMapStrings (ext: "--with ${ext} ") extensions} \
        --output k6
    '';

    installPhase = ''
      install -Dm755 k6 $out/bin/k6
    '';

    meta = with lib; {
      description = "Custom k6 build with Prometheus remote, TCP, and UDP extensions";
      homepage = "https://k6.io";
      license = licenses.agpl3Only;
      maintainers = with maintainers; [];
      platforms = [ "aarch64-darwin" "aarch64-linux" "x86_64-linux" ];
    };
  }
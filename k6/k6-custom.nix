{ pkgs }:

pkgs.writeShellScriptBin "k6" ''
  echo "This is a dummy k6 custom build"
  echo "Add your actual k6 with extensions build logic here"
  exit 1
''

# { lib, stdenv, buildGoModule, fetchFromGitHub, xk6 }:

# let
#   k6Version = "1.2.3";
#   extensions = [
#     "github.com/grafana/xk6-output-prometheus-remote@latest"
#     "github.com/NAlexandrov/xk6-tcp@latest"
#     "github.com/hoprnet/xk6-udp@latest"
#   ];

#   # Build k6 with extensions using xk6
#   k6-with-extensions = stdenv.mkDerivation rec {
#     pname = "k6-custom";
#     version = "${k6Version}+extensions";

#     nativeBuildInputs = [ xk6 ];

#     # Don't need a source since xk6 will fetch everything
#     dontUnpack = true;

#     buildPhase = ''
#       # Build k6 with all extensions
#       xk6 build \
#         --with ${lib.concatStringsSep " --with " extensions} \
#         --output k6
#     '';

#     installPhase = ''
#       install -Dm755 k6 $out/bin/k6
#     '';

#     meta = with lib; {
#       description = "Custom k6 build with Prometheus remote, TCP, and UDP extensions";
#       homepage = "https://k6.io";
#       license = licenses.agpl3Only;
#       maintainers = with maintainers; [];
#       platforms = platforms.unix;
#     };
#   };

# in
# k6-with-extensions
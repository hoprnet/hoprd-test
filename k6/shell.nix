{ pkgs , k6-custom }:
let
  linuxPkgs = with pkgs; lib.optional stdenv.isLinux (
    inotify-tools
  );
in
with pkgs;
mkShell {
  nativeBuildInputs = [
    pkgs.nodejs_20
    pkgs.yarn
    pkgs.xk6
    k6-custom
    ] ++ linuxPkgs;
}

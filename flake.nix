{
  description = "hoprd-test — HOPR integration throughput test";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/release-25.11";
    flake-utils.url = "github:numtide/flake-utils";
    pre-commit.url = "github:cachix/git-hooks.nix";
    pre-commit.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      pre-commit,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };

        # Lightweight hook set — generic hygiene + workflow checks. Deliberately
        # excludes hoprnet's Rust/metrics hooks (check-bench-names,
        # generate-metrics-docs, sync-copilot-instructions): those call
        # .github/scripts/* that live in hoprnet, not here. Modeled on hoprd's flake.
        pre-commit-check = pre-commit.lib.${system}.run {
          src = ./.;
          hooks = {
            check-executables-have-shebangs.enable = true;
            check-shebang-scripts-are-executable.enable = true;
            check-case-conflicts.enable = true;
            check-symlinks.enable = true;
            check-merge-conflicts.enable = true;
            check-added-large-files.enable = true;
            commitizen.enable = true;
            actionlint.enable = true;
            pinact = {
              enable = true;
              name = "pinact";
              description = "Check GitHub Action refs are SHA-pinned and resolvable";
              entry = "${pkgs.writeShellScript "pinact-check" ''
                token="''${GITHUB_TOKEN:-$(${pkgs.gh}/bin/gh auth token 2>/dev/null || true)}"
                if [ -z "$token" ]; then
                  echo "pinact: skipping — no GITHUB_TOKEN and gh not authenticated" >&2
                  exit 0
                fi
                export GITHUB_TOKEN="$token"
                exec ${pkgs.pinact}/bin/pinact run --check
              ''}";
              files = "^\\.github/workflows/.*\\.ya?ml$";
              language = "system";
              pass_filenames = false;
            };
          };
        };
      in
      {
        checks.pre-commit-check = pre-commit-check;

        # `nix develop` installs the git hooks and (re)writes .pre-commit-config.yaml.
        # The Rust crate itself builds in the hoprnet dev shell — see the justfile.
        devShells.default = pkgs.mkShell {
          inherit (pre-commit-check) shellHook;
          packages = with pkgs; [
            gh
            just
            python3
            pinact
            actionlint
          ];
        };
      }
    );
}

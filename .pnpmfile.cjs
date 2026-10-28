const sheetJsTarball = "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz";
const sheetJsIntegrity =
  "sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==";

module.exports = {
  hooks: {
    afterAllResolved(lockfile) {
      const sheetJs = lockfile.packages?.[`xlsx@${sheetJsTarball}`];
      if (!sheetJs) return lockfile;

      const { resolution } = sheetJs;
      if (
        sheetJs.version !== "0.20.3" ||
        resolution?.tarball !== sheetJsTarball ||
        (resolution.integrity && resolution.integrity !== sheetJsIntegrity)
      ) {
        throw new Error(
          "SheetJS resolution differs from the reviewed SHA-512 pin.",
        );
      }

      // pnpm 10.14.0 re-resolves URL dependencies without their saved integrity.
      // Keep the independently verified pin when dependency updates rewrite it.
      resolution.integrity = sheetJsIntegrity;
      return lockfile;
    },
  },
};

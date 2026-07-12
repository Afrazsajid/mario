$code = @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;

public static class CloudPrep {
  static bool IsBorderWhite(Color c) {
    return c.R >= 238 && c.G >= 238 && c.B >= 238 &&
      Math.Abs(c.R - c.G) <= 10 && Math.Abs(c.G - c.B) <= 10;
  }

  public static void Prepare(string sourcePath, string targetPath) {
    using (var source = new Bitmap(sourcePath)) {
      int w = source.Width, h = source.Height;
      bool[,] visited = new bool[w, h];
      var queue = new Queue<Tuple<int, int>>();
      Action<int, int> enqueue = (x, y) => {
        if (x < 0 || y < 0 || x >= w || y >= h || visited[x, y]) return;
        if (!IsBorderWhite(source.GetPixel(x, y))) return;
        visited[x, y] = true;
        queue.Enqueue(Tuple.Create(x, y));
      };

      for (int x = 0; x < w; x++) { enqueue(x, 0); enqueue(x, h - 1); }
      for (int y = 0; y < h; y++) { enqueue(0, y); enqueue(w - 1, y); }

      while (queue.Count > 0) {
        var p = queue.Dequeue();
        int x = p.Item1, y = p.Item2;
        enqueue(x + 1, y);
        enqueue(x - 1, y);
        enqueue(x, y + 1);
        enqueue(x, y - 1);
      }

      int minX = w, minY = h, maxX = 0, maxY = 0;
      for (int y = 0; y < h; y++) {
        for (int x = 0; x < w; x++) {
          if (!visited[x, y]) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }

      int cropW = maxX - minX + 1;
      int cropH = maxY - minY + 1;
      using (var output = new Bitmap(cropW, cropH, PixelFormat.Format32bppArgb)) {
        for (int y = 0; y < cropH; y++) {
          for (int x = 0; x < cropW; x++) {
            int sx = x + minX, sy = y + minY;
            if (visited[sx, sy]) {
              output.SetPixel(x, y, Color.FromArgb(0, 255, 255, 255));
            } else {
              Color c = source.GetPixel(sx, sy);
              output.SetPixel(x, y, Color.FromArgb(255, c.R, c.G, c.B));
            }
          }
        }
        output.Save(targetPath, ImageFormat.Png);
        Console.WriteLine("Created " + targetPath + " (" + cropW + " x " + cropH + ")");
      }
    }
  }
}
"@

Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

$sourcePath = (Resolve-Path (Join-Path $PSScriptRoot "..\sprites\cloud.jpg")).Path
$targetPath = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..\sprites")).Path "cloud-transparent.png"
[CloudPrep]::Prepare($sourcePath, $targetPath)

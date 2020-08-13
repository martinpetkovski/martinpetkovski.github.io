function Resize-Image
{
    Param([Parameter(Mandatory=$true)][string]$InputFile, [string]$OutputFile, [int32]$Width, [int32]$Height, [int32]$Scale, [Switch]$Display)

    Add-Type -AssemblyName System.Drawing

    $img = [System.Drawing.Image]::FromFile((Get-Item $InputFile))

    if($Width -gt 0) { [int32]$new_width = $Width }
    elseif($Scale -gt 0) { [int32]$new_width = $img.Width * ($Scale / 100) }
    else { [int32]$new_width = $img.Width / 2 }
    if($Height -gt 0) { [int32]$new_height = $Height }
    elseif($Scale -gt 0) { [int32]$new_height = $img.Height * ($Scale / 100) }
    else { [int32]$new_height = $img.Height / 2 }

    $img2 = New-Object System.Drawing.Bitmap($new_width, $new_height)

    $graph = [System.Drawing.Graphics]::FromImage($img2)
    $graph.DrawImage($img, 0, 0, $new_width, $new_height)

    if($Display)
    {
        Add-Type -AssemblyName System.Windows.Forms
        $win = New-Object Windows.Forms.Form
        $box = New-Object Windows.Forms.PictureBox
        $box.Width = $new_width
        $box.Height = $new_height
        $box.Image = $img2
        $win.Controls.Add($box)
        $win.AutoSize = $true
        $win.ShowDialog()
    }

    if($OutputFile -ne "")
    {
        $img2.Save($OutputFile);
    }
}

$source = "D:\Projects\GitHub\martinpetkovski.github.io\photos"
$destination = "D:\Projects\GitHub\martinpetkovski.github.io\photos\thumbnails"

Remove-Item $destination -Recurse
New-Item -Path $source -Name "thumbnails" -ItemType "directory"

$source_listephotos = Get-ChildItem $source -Filter *.JPG -Recurse

foreach ( $source_photos in $source_listephotos ) {
	$destinationPath = "$destination\$source_photos"
	Write-Host $destinationPath
    Resize-Image -InputFile $source_photos.FullName -Scale 5 -OutputFile $destinationPath -Verbose
}
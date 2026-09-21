# A fixed JSON-lines protocol. No model-provided code, script or command is evaluated.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class SteveInput {
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
 [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr v);
 [DllImport("user32.dll")] public static extern uint SendInput(uint n, INPUT[] inputs, int size);
 [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public UNION u; }
 [StructLayout(LayoutKind.Explicit)] public struct UNION { [FieldOffset(0)] public MOUSE mouse; [FieldOffset(0)] public KEY key; }
 [StructLayout(LayoutKind.Sequential)] public struct MOUSE {public int x,y;public uint data,flags,time;public UIntPtr extra;}
 [StructLayout(LayoutKind.Sequential)] public struct KEY {public ushort vk,scan;public uint flags,time;public UIntPtr extra;}
 public static void Text(string text) {foreach(char ch in text){var a=new INPUT[2]; a[0].type=1;a[0].u.key.scan=ch;a[0].u.key.flags=4;a[1]=a[0];a[1].u.key.flags=6;if(SendInput(2,a,Marshal.SizeOf(typeof(INPUT)))!=2)throw new Exception("Text input was blocked");}}
}
'@
[void][SteveInput]::SetProcessDpiAwarenessContext([IntPtr](-4))
$elements = @{}
$snapshotHwnd = ''
$snapshotTime = [DateTime]::MinValue
$snapshotFocus = ''
$snapshotOwner = [uint32]0
$scrollElement = $null
while ($null -ne ($line = [Console]::ReadLine())) {
 $request = $null
 try {
  $request = $line | ConvertFrom-Json
  if ($request.command -eq 'snapshot') {
   $hwnd = [SteveInput]::GetForegroundWindow()
   $ownerId = [uint32]0
   [void][SteveInput]::GetWindowThreadProcessId($hwnd,[ref]$ownerId)
   if ($ownerId -eq $request.ignorePid) { throw '请先切换到要操作的窗口' }
   $root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
   $snapshotOwner = $ownerId
   $focus = [System.Windows.Automation.AutomationElement]::FocusedElement
   $snapshotFocus = ''
   $scrollElement = $null
   if ($null -ne $focus -and $focus.Current.ProcessId -eq $ownerId) {
    $snapshotFocus = ($focus.GetRuntimeId() -join '_')
    $ancestor = $focus
    for ($depth=0; $depth -lt 30 -and $null -ne $ancestor; $depth++) {
     if ($ancestor.Current.ProcessId -ne $ownerId) { break }
     $scrollPattern = $null
     if ($ancestor.TryGetCurrentPattern([System.Windows.Automation.ScrollPattern]::Pattern,[ref]$scrollPattern) -and $scrollPattern.Current.VerticallyScrollable) { $scrollElement=$ancestor; break }
     $ancestor = [System.Windows.Automation.TreeWalker]::ControlViewWalker.GetParent($ancestor)
    }
   }
   $elements = @{}
   $targets = @()
   $queue = [System.Collections.Queue]::new()
   $queue.Enqueue($root)
   $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
   $scanned = 0
   while ($queue.Count -gt 0 -and $scanned -lt 500 -and $targets.Count -lt 100) {
    $el = $queue.Dequeue(); $scanned++
    try {
     $c = $el.Current
     $pattern = $null
     if ($c.IsEnabled -and -not $c.IsOffscreen -and -not $c.IsPassword -and $c.BoundingRectangle.Width -ge 12 -and $c.BoundingRectangle.Height -ge 12 -and $el.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$pattern)) {
      $id = ($el.GetRuntimeId() -join '_')
      $elements[$id] = @{ element=$el; rect=$c.BoundingRectangle }
      $targets += @{id=$id;label=$c.Name;x=$c.BoundingRectangle.X;y=$c.BoundingRectangle.Y;width=$c.BoundingRectangle.Width;height=$c.BoundingRectangle.Height}
     }
     $child = $walker.GetFirstChild($el)
     while ($null -ne $child -and $queue.Count -lt 500) { $queue.Enqueue($child); $child=$walker.GetNextSibling($child) }
    } catch { }
   }
   $snapshotHwnd = $hwnd.ToInt64().ToString(); $snapshotTime=[DateTime]::UtcNow
   $result = @{hwnd=$snapshotHwnd;title=$root.Current.Name;targets=@($targets)}
  } elseif ($request.command -eq 'execute') {
   if ($request.hwnd -ne $snapshotHwnd -or ([DateTime]::UtcNow-$snapshotTime).TotalSeconds -gt 12 -or [SteveInput]::GetForegroundWindow().ToInt64().ToString() -ne $snapshotHwnd) {throw '当前窗口已变化，请重新选择'}
   if ($request.action -eq 'click') {
    $entry=$elements[$request.targetId];if($null -eq $entry){throw '目标不存在'}
    $c=$entry.element.Current
    if(-not $c.IsEnabled -or $c.IsOffscreen -or $c.BoundingRectangle -ne $entry.rect){throw '按钮位置或状态已变化'}
    $p=$entry.element.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $p.Invoke()
   } elseif ($request.action -eq 'text') {
    $focused=[System.Windows.Automation.AutomationElement]::FocusedElement
    if($null -eq $focused -or $focused.Current.IsPassword -or -not $focused.Current.IsEnabled -or $focused.Current.ProcessId -ne $snapshotOwner -or ($focused.GetRuntimeId() -join '_') -ne $snapshotFocus){throw '编辑焦点已变化，请重新读取窗口'}
    $controlType=$focused.Current.ControlType
    if($controlType -ne [System.Windows.Automation.ControlType]::Edit -and $controlType -ne [System.Windows.Automation.ControlType]::Document){throw '当前焦点不是支持的编辑控件'}
    $valuePattern=$null
    if($focused.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$valuePattern) -and $valuePattern.Current.IsReadOnly){throw '当前编辑控件只读'}
    [SteveInput]::Text([string]$request.text)
   } elseif ($request.action -eq 'scrollUp' -or $request.action -eq 'scrollDown') {
    if($null -eq $scrollElement -or $scrollElement.Current.IsOffscreen){throw '当前焦点没有支持的可滚动区域'}
    $scroll=$scrollElement.GetCurrentPattern([System.Windows.Automation.ScrollPattern]::Pattern)
    $amount=if($request.action -eq 'scrollUp'){[System.Windows.Automation.ScrollAmount]::LargeDecrement}else{[System.Windows.Automation.ScrollAmount]::LargeIncrement}
    $scroll.Scroll([System.Windows.Automation.ScrollAmount]::NoAmount,$amount)
   } else {throw 'Unsupported action'}
   $snapshotHwnd='';$elements=@{};$result=@{ok=$true}
  } else {throw 'Unsupported command'}
  [Console]::WriteLine((@{id=$request.id;result=$result}|ConvertTo-Json -Depth 8 -Compress))
 } catch {[Console]::WriteLine((@{id=$request.id;error=$_.Exception.Message}|ConvertTo-Json -Compress))}
}

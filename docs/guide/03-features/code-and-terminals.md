---
title: Code and terminals
description: Code blocks with titles and highlighted lines, and terminal windows in five colours.
sidebar:
  order: 2
---

Code goes between two lines of three backticks.

## Code blocks

Name the language after the backticks for syntax colouring, and add a `title` to show a file name. Learners get a copy button on every block.

```python title="hash_password.py"
import hashlib, os
salt = os.urandom(16)
print(hashlib.pbkdf2_hmac("sha256", b"Summer2024!", salt, 600_000).hex())
```

````md
```python title="hash_password.py"
import hashlib, os
salt = os.urandom(16)
print(hashlib.pbkdf2_hmac("sha256", b"Summer2024!", salt, 600_000).hex())
```
````

## Commands to run

Use `sh` for commands learners should copy and run, without any output. It's shown in a terminal frame with a copy button:

```sh
nmap -sV -p 22,80,443 192.0.2.10
```

````md
```sh
nmap -sV -p 22,80,443 192.0.2.10
```
````

## Highlighting lines

Put line numbers in braces after the language to highlight them, counting from 1: `{3}`, `{2,4}` or a range `{3-4}`. Add `showLineNumbers` to number the lines.

```nginx title="nginx.conf" {3-4} showLineNumbers
server {
    listen 80;
    server_tokens off;
    add_header X-Content-Type-Options nosniff;

    location /admin { deny all; }
}
```

````md
```nginx title="nginx.conf" {3-4} showLineNumbers
server {
    listen 80;
    server_tokens off;
    add_header X-Content-Type-Options nosniff;
    …
```
````

## Terminal windows

A `terminal` block shows commands with their output, in a terminal window. Prompts are coloured automatically: the Kali two-line prompt, `user@host:~$`, a bare `$`, `#` for root, and the Windows prompts `PS C:\>` (PowerShell) and `C:\>` (Command Prompt). Everything else is output.

```terminal
┌──(student㉿kali)-[~]
└─$ nmap -sV 192.0.2.10
PORT    STATE SERVICE VERSION
22/tcp  open  ssh     OpenSSH 9.6
```

````md
```terminal
┌──(student㉿kali)-[~]
└─$ nmap -sV 192.0.2.10
PORT    STATE SERVICE VERSION
22/tcp  open  ssh     OpenSSH 9.6
```
````

A Windows machine works the same way:

```terminal-blue title="Windows (win01)"
PS C:\Users\admin> netsh advfirewall show currentprofile state

Public Profile Settings:
----------------------------------------------------------------------
State                                 ON
Ok.
```

````md
```terminal-blue title="Windows (win01)"
PS C:\Users\admin> netsh advfirewall show currentprofile state

Public Profile Settings:
----------------------------------------------------------------------
State                                 ON
Ok.
```
````

## Coloured terminals

When a lesson switches between machines, colour each one: `terminal-red`, `terminal-blue`, `terminal-green`, `terminal-purple` or `terminal-orange`. Give each a `title` too, so the colour isn't the only clue.

```terminal-red title="Attacker (Kali)"
┌──(student㉿kali)-[~]
└─$ hydra -l admin -P rockyou.txt ssh://192.0.2.10
[22][ssh] host: 192.0.2.10   login: admin   password: Summer2024!
```

```terminal-blue title="Defender (SOC)"
analyst@soc:~$ grep -c "Failed password" /var/log/auth.log
1843
analyst@soc:~$ sudo fail2ban-client set sshd banip 192.0.2.66
1
```

```terminal-green title="Target (web01)"
root@web01:~# last -n 2
admin    pts/0    192.0.2.66    Thu Sep 25 10:02   still logged in
admin    pts/0    192.0.2.66    Thu Sep 25 10:01 - 10:01  (00:00)
```

```terminal-purple title="Jump host (bastion)"
admin@bastion:~$ ssh -J admin@bastion admin@198.51.100.20
Last login: Thu Sep 25 09:58:12 2026 from 192.0.2.5
```

```terminal-orange title="Database (db01)"
dba@db01:~$ sudo -u postgres psql -c "SELECT usename FROM pg_user;"
 usename
----------
 postgres
 webapp
(2 rows)
```

````md
```terminal-red title="Attacker (Kali)"
└─$ hydra -l admin -P rockyou.txt ssh://192.0.2.10
```

```terminal-blue title="Defender (SOC)"
analyst@soc:~$ grep -c "Failed password" /var/log/auth.log
1843
```
````

`terminal-green`, `terminal-purple` and `terminal-orange` work the same way.

:::caution
Use documentation addresses (`192.0.2.x`, `198.51.100.x`, `203.0.113.x`) and `.example` domains in examples, never real ones.
:::

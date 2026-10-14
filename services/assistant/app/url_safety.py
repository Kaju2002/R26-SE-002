# app/url_safety.py
# The company check makes employer-verification visit the website (and the email's domain)
# the user gave. Addresses that point inside a network (localhost, 10.x, 192.168.x, cloud
# metadata, ...) are never passed on, so the check cannot be used to reach internal services.

import asyncio
import ipaddress
import socket
from typing import List, Optional, Union
from urllib.parse import urlsplit

DNS_TIMEOUT_SECONDS = 3.0
_LOCAL_SUFFIXES = (".localhost", ".local", ".internal", ".lan", ".home", ".intranet", ".corp")

IpAddress = Union[ipaddress.IPv4Address, ipaddress.IPv6Address]


def _ip(host: str) -> Optional[IpAddress]:
    """The address if `host` is an IP literal, including short forms such as 127.1 or 0x7f000001."""
    try:
        return ipaddress.ip_address(host.strip("[]"))
    except ValueError:
        pass
    try:
        return ipaddress.ip_address(socket.inet_aton(host))
    except (OSError, ValueError):
        return None


def _public(ip: IpAddress) -> bool:
    return ip.is_global and not ip.is_multicast


async def resolve(host: str) -> List[str]:
    """IP addresses for `host`; empty if it cannot be resolved in time."""
    loop = asyncio.get_running_loop()
    try:
        infos = await asyncio.wait_for(loop.getaddrinfo(host, None), DNS_TIMEOUT_SECONDS)
    except (OSError, asyncio.TimeoutError):
        return []
    return [info[4][0] for info in infos]


async def host_problem(host: str) -> Optional[str]:
    """Why this host must not be visited, or None if it is a public address."""
    host = (host or "").strip().rstrip(".").lower()
    if not host:
        return "it has no address"
    ip = _ip(host)
    if ip is not None:
        return None if _public(ip) else "it points to a private network"
    if host == "localhost" or host.endswith(_LOCAL_SUFFIXES) or "." not in host:
        return "it points to a private network"
    # A name that cannot be resolved is left to the service, which simply will not reach it.
    for address in await resolve(host):
        ip = _ip(address.split("%")[0])
        if ip is not None and not _public(ip):
            return "it points to a private network"
    return None


async def website_problem(url: str) -> Optional[str]:
    """Why this website must not be visited, or None if it is safe to pass on."""
    url = (url or "").strip()
    if "://" not in url:
        url = f"http://{url}"
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError:
        return "it is not a valid web address"
    if parts.scheme.lower() not in ("http", "https"):
        return "only http and https addresses can be checked"
    if "@" in parts.netloc:
        return "it is not a valid web address"
    if port not in (None, 80, 443):
        return "only the normal web ports can be checked"
    return await host_problem(parts.hostname or "")


async def email_problem(email: str) -> Optional[str]:
    domain = (email or "").rpartition("@")[2]
    return await host_problem(domain)

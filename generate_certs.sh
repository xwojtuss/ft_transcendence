#!/bin/bash
if [ ! -f secrets/ft_transcendence.key ] || [ ! -f secrets/ft_transcendence.crt ]; then \
    openssl req \
        -newkey rsa:2048 -nodes -keyout secrets/ft_transcendence.key \
        -subj "/CN=ft_transcendence/C=PL/ST=Masovian Voivodeship/L=Warsaw/O=42/OU=Student" \
        -x509 -days 365 -out secrets/ft_transcendence.crt; \
fi
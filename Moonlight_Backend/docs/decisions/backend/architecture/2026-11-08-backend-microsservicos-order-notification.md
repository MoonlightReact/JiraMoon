# Microsserviços Order e Notification, com banco por serviço

**Status:** Proposto
**Data:** 2026-11-10

## Contexto
O backend hoje é um monólito modular (ver ADR de 2026-11-08). Order
e Notification têm baixa relação entre si: o Order só precisa
informar que um pedido mudou de estado, e a notificação não
influencia o resultado do pedido. A comunicação entre os serviços
do projeto deve ser assíncrona, para que os serviços dependam o
mínimo possível uns dos outros.
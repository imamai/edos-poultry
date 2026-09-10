-- Same PUBLIC/anon default-privilege leak as migrations 0004/0005, on the
-- two trigger functions added in 0010.

revoke execute on function public.poultryedos_recompute_inventory_stock() from public, anon, authenticated;
revoke execute on function public.poultryedos_receive_purchase_order() from public, anon, authenticated;

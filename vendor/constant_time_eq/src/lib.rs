#![no_std]

#[inline]
pub fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() { return false; }
    let mut res = 0;
    for i in 0..a.len() { res |= a[i] ^ b[i]; }
    res == 0
}

#[inline]
pub fn constant_time_eq_n<const N: usize>(a: &[u8; N], b: &[u8; N]) -> bool {
    let mut res = 0;
    for i in 0..N { res |= a[i] ^ b[i]; }
    res == 0
}

#ifndef __UTIL_H__
#define __UTIL_H__

typedef unsigned int dword;
template<typename T>
void pechati_niza(T niza[], int n)
{
	for (dword i = 0; i < n; i++)
		cout << niza[i] << " ";
}

#endif
#include<iostream>
#include"util\util.h"
using namespace std;

int binarno_prebaruvanje_recursive(int niza[], dword n_max, int kluch, dword n_min = 0)
{
	if (n_max < n_min)
		return -1;
	else
	{
		int sredina = (n_max + n_min) / 2;

		if (niza[sredina] > kluch)
			return binarno_prebaruvanje_recursive(niza, sredina - 1, kluch, n_min);
		else if (niza[sredina] < kluch)
			return binarno_prebaruvanje_recursive(niza, n_max, kluch, sredina + 1);
		else
			return sredina;
	}
}

int binarno_prebaruvanje_iterative(int niza[], dword n_max, int kluch)
{
	dword n_min = 0;

	while (n_max >= n_min)
	{
		dword sredina = (n_min + n_max) / 2;
		if (niza[sredina] == kluch)
			return sredina;
		else if (niza[sredina] < kluch)
			n_min = sredina + 1;
		else
			n_max = sredina - 1;
	}
	return -1;
}
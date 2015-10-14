#include<iostream>
#include"util\util.h"
using namespace std;

int sekvencijalno_prebaruvanje(int niza[], dword n, int kluch)
{
	for (dword i = 0; i < n; i++)
		if (niza[i] == kluch)
			return i;
	return -1;
}